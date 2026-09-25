'use client';

import { useCallback, useState } from 'react';
import { registerUser, lookupUserByPhone } from '@/lib/registeredUsers';

export interface CreateSubscriptionFormInput {
  userPhone: string; // raw, as typed
  type: 'trial' | 'paid';
  durationDays: number;
  // Empty string when type='trial'. The hook coerces to null in the
  // request body so the schema's trial-only-null rule is honoured.
  paymentRef: string;
  // Epoch ms; null means "use Date.now() server-side".
  startDate: number | null;
}

export type CreateSubscriptionSuccess = { ok: true; id: string; roomCode: string | null };
export type CreateSubscriptionFailure = {
  ok: false;
  error: string;
  fields?: Record<string, string>;
};
export type CreateSubscriptionOutcome =
  | CreateSubscriptionSuccess
  | CreateSubscriptionFailure;

export interface UseCreateSubscriptionResult {
  submit: (
    input: CreateSubscriptionFormInput,
  ) => Promise<CreateSubscriptionOutcome>;
  submitting: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
}

const GENERIC_FAILURE = 'Không thể tạo gói đăng ký. Vui lòng thử lại.';

export function useCreateSubscription(): UseCreateSubscriptionResult {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useCallback(
    async (
      input: CreateSubscriptionFormInput,
    ): Promise<CreateSubscriptionOutcome> => {
      setSubmitting(true);
      setError(null);
      setFieldErrors({});

      const body: Record<string, unknown> = {
        userPhone: input.userPhone,
        type: input.type,
        durationDays: input.durationDays,
      };
      if (input.type === 'paid') {
        body.paymentRef = input.paymentRef;
      }
      if (input.startDate !== null) {
        body.startDate = input.startDate;
      }

      let res: Response;
      try {
        res = await fetch('/api/admin/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch {
        setError(GENERIC_FAILURE);
        setSubmitting(false);
        return { ok: false, error: GENERIC_FAILURE };
      }

      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        // empty / non-JSON body
      }

      if (res.status === 201) {
        const id =
          parsed && typeof parsed === 'object' && 'id' in parsed
            ? String((parsed as { id: unknown }).id)
            : '';
        let roomCode: string | null = null;
        try {
          const reg = await registerUser({ phone: input.userPhone });
          roomCode = reg.roomCode;
        } catch (err) {
          if (err instanceof Error && err.message.includes('already registered')) {
            try {
              const existing = await lookupUserByPhone(input.userPhone);
              roomCode = existing?.roomCode ?? null;
            } catch {
              // lookup failed — room code stays null
            }
          }
          // other errors: subscription still created, just no room code
        }
        setSubmitting(false);
        return { ok: true, id, roomCode };
      }

      const errBody = (parsed ?? {}) as {
        error?: string;
        message?: string;
        fields?: Record<string, string>;
      };

      if (res.status === 400) {
        const fields = errBody.fields ?? {};
        setFieldErrors(fields);
        setError(null);
        setSubmitting(false);
        return {
          ok: false,
          error: errBody.error ?? 'invalid_input',
          fields,
        };
      }

      if (res.status === 409) {
        const msg = errBody.message ?? GENERIC_FAILURE;
        setError(msg);
        setSubmitting(false);
        return {
          ok: false,
          error: errBody.error ?? 'conflict',
        };
      }

      setError(GENERIC_FAILURE);
      setSubmitting(false);
      return { ok: false, error: GENERIC_FAILURE };
    },
    [],
  );

  return { submit, submitting, error, fieldErrors };
}
