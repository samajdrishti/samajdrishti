import { evidenceAPI, inspectionAPI, getClientId } from './api';

const EVIDENCE_KEY = 'sd_offline_evidence';
const INSPECTION_KEY = 'sd_offline_inspections';
const MAX_QUEUE_SIZE = 50;
export const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1500;
const MAX_BACKOFF_MS = 30000;

const read = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // QuotaExceeded: drop the oldest entries (keeping the newest work) and retry once.
    try {
      const trimmed = Array.isArray(value) ? value.slice(-Math.floor(MAX_QUEUE_SIZE / 2)) : [];
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch (err2) {
      /* storage unavailable — queue write is best-effort */
    }
  }
};

const withId = (payload) => {
  if (payload?._id) return payload;
  return { ...payload, _id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` };
};

export const queueEvidence = (payload) => {
  const queue = read(EVIDENCE_KEY);
  const item = withId({ ...payload, client_id: payload?.client_id || getClientId() });
  if (queue.some((q) => q._id === item._id)) return queue.length;
  queue.push({ ...item, queued_at: new Date().toISOString(), _retries: 0 });
  while (queue.length > MAX_QUEUE_SIZE) queue.shift(); // FIFO evict oldest; never throw
  write(EVIDENCE_KEY, queue);
  return queue.length;
};

export const queueInspectionUpdate = (id, data) => {
  const queue = read(INSPECTION_KEY);
  const stamped = withId({ ...data });
  if (queue.some((q) => q._id === stamped._id)) return queue.length;
  queue.push({ id, data: stamped, queued_at: new Date().toISOString(), _retries: 0 });
  while (queue.length > MAX_QUEUE_SIZE) queue.shift();
  write(INSPECTION_KEY, queue);
  return queue.length;
};

export const pendingCounts = () => {
  const evidence = read(EVIDENCE_KEY).length;
  const inspections = read(INSPECTION_KEY).length;
  return { evidence, inspections, total: evidence + inspections };
};

export const pendingEvidence = () => read(EVIDENCE_KEY);
export const pendingInspections = () => read(INSPECTION_KEY);

export const clearQueues = () => {
  try {
    localStorage.removeItem(EVIDENCE_KEY);
    localStorage.removeItem(INSPECTION_KEY);
  } catch (err) {
    /* ignore */
  }
};

export const backoffFor = (retries) =>
  Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, retries - 1), MAX_BACKOFF_MS);

/**
 * Replays one queue sequentially: only items that succeed are removed, failures
 * stay queued with a retry counter, poison items (>MAX_RETRIES) are dropped and
 * counted as failed. Backoff is applied by the caller spacing out flush calls
 * (reconnect / interval) — see backoffFor — so a single flush never blocks the
 * UI thread; sequential replay keeps evidence order stable and avoids hammering
 * a flaky field connection with parallel uploads.
 */
const flushList = async (key, apiFn) => {
  const queue = read(key);
  if (!queue.length) return { synced: 0, failed: 0, remaining: 0 };
  const remaining = [];
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await apiFn(item);
      synced += 1;
    } catch (err) {
      const retries = (item._retries || 0) + 1;
      if (retries >= MAX_RETRIES) {
        failed += 1; // poison — drop it so the queue can drain
      } else {
        remaining.push({ ...item, _retries: retries, last_error: String(err?.message || err).slice(0, 200) });
      }
    }
  }

  write(key, remaining);
  return { synced, failed, remaining: remaining.length };
};

/**
 * Replays the queue with idempotency keys. Only items that actually succeed
 * are removed. Safe to call on every reconnect.
 */
export const flushQueue = async () => {
  const evidence = await flushList(EVIDENCE_KEY, (item) => evidenceAPI.upload(item));
  const inspections = await flushList(INSPECTION_KEY, (item) =>
    inspectionAPI.updateStatus(item.id, item.data)
  );
  return { evidence, inspections };
};
