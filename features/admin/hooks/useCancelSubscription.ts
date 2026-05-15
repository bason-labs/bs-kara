'use client';

import { useCallback, useState } from 'react';

export type CancelSubscriptionOutcome =
  | { ok: true }
  | { ok: false; error: string; message: string };

interface UseCancelSubscriptionResult {
  cancel: (id: string) => Promise<CancelSubscriptionOutcome>;
  cancelling: boolean;
  error: string | null;
}

const GENERIC_FAILURE = 'Không thể huỷ gói. Vui lòng thử lại.';

export function useCancelSubscription(): UseCancelSubscriptionResult {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(
    async (id: string): Promise<CancelSubscriptionOutcome> => {
      setCancelling(true);
      setError(null);

      let res: Response;
      try {
        res = await fetch(
          `/api/admin/subscriptions/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel' }),
          },
        );
      } catch {
        setError(GENERIC_FAILURE);
        setCancelling(false);
        return { ok: false, error: 'network_error', message: GENERIC_FAILURE };
      }

      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        // body wasn't JSON; fall through to generic handling
      }

      if (res.status === 200) {
        setCancelling(false);
        return { ok: true };
      }

      const errBody = (parsed ?? {}) as { error?: string; message?: string };
      const message = errBody.message ?? GENERIC_FAILURE;
      const errCode = errBody.error ?? `http_${res.status}`;

      setError(message);
      setCancelling(false);
      return { ok: false, error: errCode, message };
    },
    [],
  );

  return { cancel, cancelling, error };
}
