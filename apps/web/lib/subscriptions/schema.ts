import { z } from 'zod';
import { isE164VN } from './phone';

export type SubscriptionType = 'trial' | 'paid';
// Stored values are only 'active' or 'cancelled'. 'expired' is NEVER
// persisted — it is derived on read from endDate < now (see expiry.ts).
export type SubscriptionStatus = 'active' | 'cancelled';
export type DerivedStatus = SubscriptionStatus | 'expired';
export type SubscriptionSource =
  | 'manual_admin'
  | 'self_register_phone'
  | 'payment_webhook';

export interface SubscriptionRecord {
  id: string;
  userPhone: string; // E.164 +84XXXXXXXXX
  userId: string | null;
  type: SubscriptionType;
  status: SubscriptionStatus;
  durationDays: number; // 1..365
  startDate: number; // epoch ms
  endDate: number; // epoch ms = startDate + durationDays * 86_400_000
  source: SubscriptionSource;
  paymentRef: string | null; // required iff type='paid', null iff type='trial'
  createdBy: string | null; // admin uid for manual_admin, null otherwise
  createdAt: number;
  updatedAt: number;
}

export const SUBSCRIPTION_TYPES = ['trial', 'paid'] as const;
export const SUBSCRIPTION_STATUSES = ['active', 'cancelled'] as const;
export const SUBSCRIPTION_SOURCES = [
  'manual_admin',
  'self_register_phone',
  'payment_webhook',
] as const;

const DURATION_DAYS_MIN = 1;
const DURATION_DAYS_MAX = 365;
const PAYMENT_REF_MAX = 128;

const phoneE164VN = z.string().refine(isE164VN, {
  message: 'userPhone must be in +84XXXXXXXXX format',
});

// Base shape, before the type↔paymentRef cross-field rule. `strict()` so
// any unknown extra field rejects (matches the rules' $other:false pattern).
const RecordBase = z
  .object({
    id: z.string().min(1),
    userPhone: phoneE164VN,
    // Firebase RTDB silently drops null values on write, so these fields
    // come back as undefined (missing) when read. .nullish() = .nullable() +
    // .optional() so both null and missing-key are accepted.
    userId: z.string().min(1).nullish().transform((v) => v ?? null),
    type: z.enum(SUBSCRIPTION_TYPES),
    status: z.enum(SUBSCRIPTION_STATUSES),
    durationDays: z
      .number()
      .int()
      .min(DURATION_DAYS_MIN)
      .max(DURATION_DAYS_MAX),
    startDate: z.number().int().nonnegative(),
    endDate: z.number().int().nonnegative(),
    source: z.enum(SUBSCRIPTION_SOURCES),
    paymentRef: z.string().max(PAYMENT_REF_MAX).nullish().transform((v) => v ?? null),
    createdBy: z.string().min(1).nullish().transform((v) => v ?? null),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();

// Cross-field rule for paymentRef. Implemented via superRefine rather than
// a discriminated union so a malformed `type` field surfaces as a `type`
// error instead of an unhelpful union-mismatch error.
export const SubscriptionRecordSchema = RecordBase.superRefine((rec, ctx) => {
  if (rec.type === 'trial') {
    if (rec.paymentRef !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['paymentRef'],
        message: 'trial subscriptions must have paymentRef = null',
      });
    }
  } else {
    // paid
    if (typeof rec.paymentRef !== 'string' || rec.paymentRef.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['paymentRef'],
        message: 'paid subscriptions must have a non-empty paymentRef',
      });
    }
  }
});

// Input for createSubscription (Commit 3 consumer). userPhone is the RAW
// input from the admin form — the caller normalises it through
// `toE164VN()` before persisting. userId / source / createdBy / startDate
// are set by the create handler, not by form input.
export const CreateSubscriptionInputSchema = z
  .object({
    userPhone: z.string().min(1),
    type: z.enum(SUBSCRIPTION_TYPES),
    durationDays: z
      .number()
      .int()
      .min(DURATION_DAYS_MIN)
      .max(DURATION_DAYS_MAX),
    paymentRef: z.string().max(PAYMENT_REF_MAX).optional().nullable(),
    startDate: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.type === 'trial') {
      if (input.paymentRef != null && input.paymentRef !== '') {
        ctx.addIssue({
          code: 'custom',
          path: ['paymentRef'],
          message: 'paymentRef must be omitted/null for trial',
        });
      }
    } else {
      if (
        typeof input.paymentRef !== 'string' ||
        input.paymentRef.length === 0
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['paymentRef'],
          message: 'paymentRef is required for paid',
        });
      }
    }
  });

export type CreateSubscriptionInput = z.infer<
  typeof CreateSubscriptionInputSchema
>;

export const DAY_MS = 86_400_000;
