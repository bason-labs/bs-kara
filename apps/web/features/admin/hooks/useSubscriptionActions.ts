'use client';

import { useCallback, useState } from 'react';
import type { UpdateSubscriptionInput } from '@/lib/subscriptions/schema';

export type SubscriptionActionOutcome =
  | { ok: true }
  | { ok: false; message: string; fields?: Record<string, string> };

const GENERIC_FAILURE = 'Không thể lưu thay đổi. Vui lòng thử lại.';

// Edit and delete for one subscription (PATCH action 'update', DELETE).
export function useSubscriptionActions(id: string) {
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (init: RequestInit): Promise<SubscriptionActionOutcome> => {
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(id)}`, init);
        if (res.ok) return { ok: true };
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          fields?: Record<string, string>;
        };
        return {
          ok: false,
          message: body.message ?? Object.values(body.fields ?? {})[0] ?? GENERIC_FAILURE,
          fields: body.fields,
        };
      } catch {
        return { ok: false, message: GENERIC_FAILURE };
      } finally {
        setBusy(false);
      }
    },
    [id],
  );

  const update = useCallback(
    (changes: UpdateSubscriptionInput) =>
      send({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', changes }),
      }),
    [send],
  );

  const remove = useCallback(() => send({ method: 'DELETE' }), [send]);

  return { update, remove, busy };
}
