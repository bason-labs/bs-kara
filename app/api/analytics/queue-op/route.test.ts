import { describe, it, expect, vi, beforeEach } from 'vitest';

const { recordQueueOpMock } = vi.hoisted(() => ({
  recordQueueOpMock: vi.fn(),
}));

vi.mock('@/lib/analytics/serverAnalytics', () => ({
  recordQueueOp: recordQueueOpMock,
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/analytics/queue-op', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/analytics/queue-op', () => {
  beforeEach(() => {
    recordQueueOpMock.mockClear();
  });

  it('returns 204 and calls recordQueueOp for a valid add', async () => {
    const res = await POST(makeRequest({ roomId: '5678', action: 'add' }));
    expect(res.status).toBe(204);
    expect(recordQueueOpMock).toHaveBeenCalledWith('5678', 'add');
  });

  it('returns 204 and calls recordQueueOp for a valid remove', async () => {
    const res = await POST(makeRequest({ roomId: '5678', action: 'remove' }));
    expect(res.status).toBe(204);
    expect(recordQueueOpMock).toHaveBeenCalledWith('5678', 'remove');
  });

  it('returns 400 for missing roomId', async () => {
    const res = await POST(makeRequest({ action: 'add' }));
    expect(res.status).toBe(400);
    expect(recordQueueOpMock).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid action', async () => {
    const res = await POST(makeRequest({ roomId: '5678', action: 'reorder' }));
    expect(res.status).toBe(400);
    expect(recordQueueOpMock).not.toHaveBeenCalled();
  });

  it('returns 400 for non-JSON body', async () => {
    const req = new Request('http://localhost/api/analytics/queue-op', {
      method: 'POST',
      body: 'not json',
    }) as unknown as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
