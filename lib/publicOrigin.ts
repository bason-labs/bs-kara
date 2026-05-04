/**
 * Returns the origin used to build URLs that other devices will load
 * (QR codes, join links, share links).
 *
 * Prefers NEXT_PUBLIC_PUBLIC_ORIGIN when set — typical use is a dev tunnel
 * (ngrok / cloudflared / localtunnel) so phones scanning the TV's QR code
 * land on the developer's machine over HTTPS.
 *
 * Falls back to window.location.origin in the browser.
 * Returns null on the server when no override is set — callers should guard
 * (the existing call sites are inside 'use client' hooks/components, so
 * they reach the browser branch).
 */
export function getPublicOrigin(): string | null {
  const override = process.env.NEXT_PUBLIC_PUBLIC_ORIGIN;
  if (override) return override.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return null;
}
