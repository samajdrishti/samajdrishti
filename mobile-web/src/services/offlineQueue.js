import { evidenceAPI, inspectionAPI } from './api';

const EVIDENCE_KEY = 'sd_offline_evidence';
const INSPECTION_KEY = 'sd_offline_inspections';

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
    /* storage full or unavailable - the upload simply fails instead */
  }
};

/** Queues an evidence upload captured while offline. */
export const queueEvidence = (payload) => {
  const queue = read(EVIDENCE_KEY);
  queue.push({ ...payload, queued_at: new Date().toISOString() });
  write(EVIDENCE_KEY, queue);
  return queue.length;
};

export const queueInspectionUpdate = (id, data) => {
  const queue = read(INSPECTION_KEY);
  queue.push({ id, data, queued_at: new Date().toISOString() });
  write(INSPECTION_KEY, queue);
  return queue.length;
};

export const pendingCounts = () => ({
  evidence: read(EVIDENCE_KEY).length,
  inspections: read(INSPECTION_KEY).length,
  total: read(EVIDENCE_KEY).length + read(INSPECTION_KEY).length,
});

export const pendingEvidence = () => read(EVIDENCE_KEY);
export const pendingInspections = () => read(INSPECTION_KEY);

export const clearQueues = () => {
  localStorage.removeItem(EVIDENCE_KEY);
  localStorage.removeItem(INSPECTION_KEY);
};

/**
 * Replays the queue. Only items that actually succeed are removed, so a partial
 * failure never loses captured evidence.
 */
export const flushQueue = async () => {
  const results = {
    evidence: { synced: 0, failed: 0 },
    inspections: { synced: 0, failed: 0 },
  };

  const evidenceQueue = read(EVIDENCE_KEY);
  const keptEvidence = [];
  for (const item of evidenceQueue) {
    try {
      await evidenceAPI.upload(item);
      results.evidence.synced += 1;
    } catch (err) {
      results.evidence.failed += 1;
      keptEvidence.push(item);
    }
  }
  write(EVIDENCE_KEY, keptEvidence);

  const inspectionQueue = read(INSPECTION_KEY);
  const keptInspections = [];
  for (const item of inspectionQueue) {
    try {
      await inspectionAPI.updateStatus(item.id, item.data);
      results.inspections.synced += 1;
    } catch (err) {
      results.inspections.failed += 1;
      keptInspections.push(item);
    }
  }
  write(INSPECTION_KEY, keptInspections);

  return results;
};
