# Admin Statistics Dashboard — Design Spec

**Date:** 2026-05-14  
**Branch target:** next branch after `feat/admin-subscription-cancel`  
**Status:** Approved — proceeding to implementation plan

---

## Context

The admin surface (`app/admin/`) is a Firebase-Auth-gated Next.js App Router section. Phase 1 (subscriptions CRUD) is complete and on `feat/admin-subscription-cancel`. This spec covers Phases 2–4 of the admin statistics feature.

**Auth pattern:** `requireAdmin()` called in `app/admin/(gated)/layout.tsx` verifies a `__session` Firebase session cookie and checks `process.env.ADMIN_EMAILS`. All new routes inside `(gated)/` inherit this gate automatically. New API routes must call `requireAdmin()` explicitly at the top of each handler.

**UI conventions:** Custom Tailwind only — no shadcn/ui, no chart libraries. Theme tokens: `bg`, `fg`, `border`, `muted`, `danger`, `surface`, `gradient-brand`. Component patterns follow `features/admin/components/`.

**Data fetching conventions:** Admin pages use `force-dynamic`. Client components use plain `fetch` + `useState` + `tick`-based refetch (see `useSubscriptions.ts`). No SWR/React Query. SSR hydration guard: delay `Date.now()` to a `useEffect` (see `SubscriptionsTableContainer.tsx:13-17`).

---

## Resolved Decisions

| Question | Decision |
|---|---|
| Firebase quota tracking | Instrument call sites in `repo.ts` and `requireAdmin.ts` manually; count operations, not bytes |
| Search event privacy | Counts only — no raw query strings stored |
| YouTube quota timezone | Pacific Time (`America/Los_Angeles`) for daily bucket key |
| Whitelist management | Env var (`ADMIN_EMAILS`) stays authoritative; admin UI is read-only display only |
| Session tracking scope | End-user phone/TV sessions joining rooms (not admin login sessions) |
| Firebase quota unit | Peak simultaneous connections via RTDB presence counter |

---

## Phase 2 — Data-already-exists metrics

**Items:** Dashboard KPIs (1), Room statistics (2), YouTube quota (7), Whitelist display (8)

### New routes and files

**Page route:**  
`app/admin/(gated)/stats/page.tsx` — server page; renders `<StatsShell />` client boundary.

**API routes:**  
- `app/api/admin/stats/route.ts` — GET; reads RTDB `rooms/*` snapshot; returns active room count, active TV count, active phone count, total queue depth.  
- `app/api/admin/quota/youtube/route.ts` — GET; reads `analytics/youtubeQuota/{YYYYMMDD}` for last 30 days; returns `{ date, calls, units }[]`.

**New components (`features/admin/components/`):**  
- `StatCard.tsx` — single KPI tile: `{ label, value, sublabel? }`. Tailwind only.  
- `RoomsTable.tsx` — table of active rooms using existing `DataTable.tsx`; columns: roomId, queue depth, TV active, phone count, last ended.  
- `QuotaChart.tsx` — YouTube quota bar chart using Tailwind `div` widths (no library). Shows last 30 days, daily limit line at 10,000 units.  
- `WhitelistPanel.tsx` — server-rendered read-only list of emails from `ADMIN_EMAILS`.

**New hooks (`features/admin/hooks/`):**  
- `useStatsSnapshot.ts` — polls `/api/admin/stats` every 30s; returns `{ rooms, activeTvs, activePhones, totalQueueDepth }`.  
- `useYoutubeQuota.ts` — polls `/api/admin/quota/youtube` every 60s; returns `{ days: QuotaDay[] }`.

**Nav:** Add "Thống kê" link to `features/admin/components/AdminNav.tsx` pointing to `/admin/stats`.

### YouTube quota instrumentation (one write-path change)

In `app/api/youtube/search/route.ts` inside `tryAllKeys()`, after a successful (non-403) YouTube API response, increment RTDB `analytics/youtubeQuota/{YYYYMMDD}/calls` by 1 using `ServerValue.increment(1)`. Date key computed with `America/Los_Angeles` timezone via `Intl.DateTimeFormat`. The `units` value (calls × 100) is computed on read, not stored.

This is the only write-path change in Phase 2.

### Caching / revalidation

- `/api/admin/stats`: `force-dynamic`, `Cache-Control: no-store`. RTDB read is fast enough for on-demand.
- `/api/admin/quota/youtube`: `force-dynamic`, `Cache-Control: no-store`. Data changes at most once per search call.
- Client polls: stats every 30s, quota every 60s (manual `setInterval` in hooks, cleared on unmount).

---

## Phase 3 — Collection-gap metrics

**Items:** Search statistics (4), Queue operations (5), Device/session info (3)

These require write-path instrumentation before admin views are useful. Implement collection first, then the views.

### Gap A — Session tracking (metric 3)

**Instrumentation point:** New server-side route `app/api/room/join/route.ts` (POST).  
`claimOrGetActiveRoom()` is client-side Firebase code — `x-forwarded-for` is unreachable there. Instead, the phone/TV calls this new route on mount. The route reads `x-forwarded-for` for IP and `user-agent` for device type (`/Mobi|Android/i` regex → `'mobile'` or `'desktop'`), then writes to `analytics/sessions/{pushId}`:  
`{ ip, userAgent, deviceType, roomId, joinedAt }`.  
On room end (`lastEndedAt` write from client), a follow-up `app/api/room/leave/route.ts` (POST) writes `leftAt` to the session record.  
No new library needed.

**Admin view:** New `app/admin/(gated)/sessions/page.tsx` + `SessionsTable.tsx`.

### Gap B — Search statistics (metric 4)

**Instrumentation point:** `tryAllKeys()` in `app/api/youtube/search/route.ts`.  
On cache miss (live API call): increment `analytics/searchCounts/{YYYYMMDD}` by 1 (PT timezone).  
On cache hit: increment `analytics/searchCounts/{YYYYMMDD}/cached` by 1.  
No raw query strings stored.

**Admin view:** Counts-per-day table/chart in stats page.

### Gap C — Queue operations (metric 5)

**Instrumentation point:** Queue mutation hooks in `hooks/useRoom/queue.ts`.  
On add: `ServerValue.increment(1)` at `analytics/queueOps/{roomId}/{YYYYMMDD}/adds`.  
On remove: `ServerValue.increment(1)` at `analytics/queueOps/{roomId}/{YYYYMMDD}/removes`.

**Admin view:** Per-room and totals table in stats page.

---

## Phase 4 — Firebase quota (infra decision required)

**Item:** Firebase quota (6)

Track peak simultaneous connections via RTDB presence:  
- On client connect: `ServerValue.increment(1)` at `analytics/presenceCount`.  
- `onDisconnect`: `ServerValue.increment(-1)`.  
- On each increment, if new value > `analytics/presencePeak/{YYYYMMDD}`, update peak (transaction).

Firebase free tier limit: 100 simultaneous connections. Blaze: pay per GB transfer.

**Admin view:** Placeholder card in Phase 2 stats page with link to Firebase Console. Replace with real data in Phase 4.

---

## Firebase RTDB analytics schema

```
analytics/
  youtubeQuota/
    {YYYYMMDD}/           — PT timezone
      calls: number       — incremented per live API call; units = calls × 100 computed on read
  searchCounts/
    {YYYYMMDD}/
      live: number
      cached: number
  queueOps/
    {roomId}/
      {YYYYMMDD}/
        adds: number
        removes: number
  sessions/
    {pushId}/
      ip: string
      userAgent: string
      deviceType: 'mobile' | 'desktop'
      roomId: string
      joinedAt: number    — epoch ms
      leftAt: number | null
  presenceCount: number   — live connection count
  presencePeak/
    {YYYYMMDD}: number    — daily peak connections
```

---

## Testing requirements (per CLAUDE.md)

- Every new API route: Vitest test covering auth (401), happy path, RTDB error path.
- Every new hook: Vitest test covering loading/error/data states and refetch.
- YouTube quota instrumentation: test that `analytics/youtubeQuota/{date}` is incremented on live call and not on cache hit.
- Queue op instrumentation: test that counters increment on add/remove; no increment on read.
- Playwright: new `/admin/stats` page loads, shows KPI cards, shows quota chart.

---

## Phased summary

| Phase | Items | Branches | Effort |
|---|---|---|---|
| 1 | Subscriptions (9), Free trials (10) | `feat/admin-subscription-cancel` (done) | Done |
| 2 | Dashboard KPIs (1), Rooms (2), YouTube quota (7), Whitelist display (8) | `feat/admin-stats-phase2` | Medium |
| 3 | Search stats (4), Queue ops (5), Sessions (3) | `feat/admin-stats-phase3` | High (write-path changes) |
| 4 | Firebase quota (6) | `feat/admin-stats-phase4` | Medium (after presence design confirmed) |
