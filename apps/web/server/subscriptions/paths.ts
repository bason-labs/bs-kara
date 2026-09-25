// RTDB path helpers. Repo functions consume these — the SDK is never
// touched here. Keep this module pure so it can be re-used from rules
// tests, server routes, and (eventually) client mirrors without pulling in
// firebase-admin.

export const subscriptionPath = (id: string) => `subscriptions/${id}`;
export const subscriptionsRoot = () => `subscriptions`;
export const byPhonePath = (phoneE164: string, id: string) =>
  `subscriptionsByPhone/${phoneE164}/${id}`;
export const byPhoneRoot = (phoneE164: string) =>
  `subscriptionsByPhone/${phoneE164}`;
export const trialClaimedPath = (phoneE164: string) =>
  `subscriptionTrialClaimed/${phoneE164}`;
