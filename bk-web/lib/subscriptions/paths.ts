// RTDB path helpers. Repo functions consume these — the SDK is never
// touched here. Keep this module pure so it can be re-used from rules
// tests, server routes, and (eventually) client mirrors without pulling in
// firebase-admin.
//
// RTDB key constraint: keys cannot contain `.` `#` `$` `[` `]` `/`. Email
// keys must therefore be encoded with `.` → `,` before being used as a
// path segment under `admins/emails/`.

export const subscriptionPath = (id: string) => `subscriptions/${id}`;
export const subscriptionsRoot = () => `subscriptions`;
export const byPhonePath = (phoneE164: string, id: string) =>
  `subscriptionsByPhone/${phoneE164}/${id}`;
export const byPhoneRoot = (phoneE164: string) =>
  `subscriptionsByPhone/${phoneE164}`;
export const trialClaimedPath = (phoneE164: string) =>
  `subscriptionTrialClaimed/${phoneE164}`;
export const adminEmailsRoot = () => `admins/emails`;
export const adminEmailPath = (emailKey: string) =>
  `admins/emails/${emailKey}`;

// Encode an email address for use as an RTDB key. The only forbidden char
// in practice for email-shaped strings is `.`, which we map to `,`.
export function encodeEmailKey(email: string): string {
  return email.toLowerCase().replace(/\./g, ',');
}
