import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map();
vi.stubGlobal('localStorage', {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
});

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    evidenceAPI: { upload: vi.fn() },
    inspectionAPI: { updateStatus: vi.fn() },
  };
});

const { evidenceAPI, inspectionAPI } = await import('./api');
const queue = await import('./offlineQueue');

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('offlineQueue', () => {
  it('queues evidence with an idempotency key and dedupes replays', () => {
    expect(queue.queueEvidence({ inspection_id: 'INS-1', type: 'photo' })).toBe(1);
    expect(queue.pendingCounts().evidence).toBe(1);
    expect(queue.pendingEvidence()[0]._id).toBeTruthy();
  });

  it('evicts oldest entries past the cap instead of throwing', () => {
    for (let i = 0; i < 55; i += 1) queue.queueEvidence({ _id: `e-${i}`, inspection_id: 'INS-1' });
    const items = queue.pendingEvidence();
    expect(items.length).toBeLessThanOrEqual(50);
    expect(items[items.length - 1]._id).toBe('e-54');
  });

  it('flushQueue removes only what succeeds and keeps failures queued', async () => {
    queue.queueEvidence({ _id: 'ok-1', inspection_id: 'INS-1' });
    queue.queueEvidence({ _id: 'bad-1', inspection_id: 'INS-1' });
    evidenceAPI.upload.mockImplementation((item) => {
      if (item._id === 'bad-1') return Promise.reject(new Error('network down'));
      return Promise.resolve({ data: {} });
    });
    const result = await queue.flushQueue();
    expect(result.evidence.synced).toBe(1);
    expect(queue.pendingEvidence().map((e) => e._id)).toEqual(['bad-1']);
  });

  it('drops poison items after max retries', async () => {
    const { MAX_RETRIES } = queue;
    store.set(
      'sd_offline_evidence',
      JSON.stringify([{ _id: 'poison', inspection_id: 'INS-1', _retries: MAX_RETRIES - 1 }])
    );
    evidenceAPI.upload.mockRejectedValue(new Error('always fails'));
    const result = await queue.flushQueue();
    expect(result.evidence.failed).toBe(1);
    expect(queue.pendingEvidence()).toEqual([]);
  });

  it('exposes an exponential backoff schedule for flush callers', () => {
    expect(queue.backoffFor(1)).toBe(1500);
    expect(queue.backoffFor(2)).toBe(3000);
    expect(queue.backoffFor(10)).toBe(30000);
  });

  it('flushes inspection updates through updateStatus', async () => {
    queue.queueInspectionUpdate('INS-9', { status: 'accepted' });
    inspectionAPI.updateStatus.mockResolvedValue({ data: {} });
    const result = await queue.flushQueue();
    expect(result.inspections.synced).toBe(1);
    expect(inspectionAPI.updateStatus).toHaveBeenCalledWith('INS-9', expect.objectContaining({ status: 'accepted' }));
  });
});
