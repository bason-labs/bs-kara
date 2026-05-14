# Admin Statistics Dashboard — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `/admin/stats` page showing dashboard KPIs (rooms, TVs, queue depth), a per-room table, a YouTube API quota chart, and a read-only admin whitelist — all without a new UI library.

**Architecture:** Two new server-side API routes (`/api/admin/stats`, `/api/admin/quota/youtube`) read RTDB via the Firebase Admin SDK; two polling hooks (`useStatsSnapshot`, `useYoutubeQuota`) call them every 30 s / 60 s from a `StatsShell` client boundary rendered inside a new server page. The only write-path change is a fire-and-forget `analytics/youtubeQuota/{date}/calls` increment inside `tryAllKeys()` on each live YouTube API call.

**Tech Stack:** Next.js 15 App Router, Firebase Admin SDK (RTDB), Tailwind CSS, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-14-admin-stats-design.md`

---

## File Map

| File | Created / Modified | Responsibility |
|---|---|---|
| `app/api/youtube/search/route.ts` | **Modified** | Add fire-and-forget quota counter on live API hit |
| `app/api/youtube/search/route.test.ts` | **Created** | Verify counter increments on live call, not on cache hit |
| `app/api/admin/stats/route.ts` | **Created** | GET: read RTDB `rooms/*`, return KPIs + per-room rows |
| `app/api/admin/stats/route.test.ts` | **Created** | Auth 401, happy path, RTDB error |
| `app/api/admin/quota/youtube/route.ts` | **Created** | GET: read RTDB `analytics/youtubeQuota/*`, last 30 PT days |
| `app/api/admin/quota/youtube/route.test.ts` | **Created** | Auth 401, happy path with date filtering, RTDB error |
| `features/admin/hooks/useStatsSnapshot.ts` | **Created** | Polls `/api/admin/stats` every 30 s |
| `features/admin/hooks/useStatsSnapshot.test.ts` | **Created** | Loading, error, data, polling, cleanup |
| `features/admin/hooks/useYoutubeQuota.ts` | **Created** | Polls `/api/admin/quota/youtube` every 60 s |
| `features/admin/hooks/useYoutubeQuota.test.ts` | **Created** | Loading, error, data, polling, cleanup |
| `features/admin/components/StatCard.tsx` | **Created** | Presentational KPI tile (no test — pure presentational) |
| `features/admin/components/RoomsTable.tsx` | **Created** | Per-room table wrapping `DataTable` (no test — presentational) |
| `features/admin/components/QuotaChart.tsx` | **Created** | 30-day Tailwind bar chart (no test — presentational) |
| `features/admin/components/WhitelistPanel.tsx` | **Created** | Server component; reads `ADMIN_EMAILS` env (no test — presentational) |
| `features/admin/components/StatsShell.tsx` | **Created** | Client boundary; wires hooks → presentational components |
| `app/admin/(gated)/stats/page.tsx` | **Created** | Server page; renders `WhitelistPanel` + `StatsShell` |
| `features/admin/components/AdminNav.tsx` | **Modified** | Add `{ href: '/admin/stats', label: 'Thống kê' }` to `NAV_ITEMS` |
| `e2e/admin-stats.spec.ts` | **Created** | Playwright: page loads, sections visible |

---

## Task 1: Branch setup

- [ ] **Step 1: Create the branch**

  ```bash
  git checkout main
  git pull
  git checkout feat/admin-subscription-cancel  # merge this first if already merged; otherwise branch from it
  git checkout -b feat/admin-stats-phase2
  ```

- [ ] **Step 2: Verify the baseline checks pass**

  ```bash
  npx tsc --noEmit && npm run lint && npm run test
  ```

  Expected: typecheck clean; lint shows only the 6 pre-existing errors in `EndScreenOverlay.tsx`, `RemoteClient.tsx`, `useFullscreenOwnership.ts` (none in admin or search files); Vitest shows 1 pre-existing fail in `VideoPlayer.test.tsx`, all others green.

---

## Task 2: YouTube quota instrumentation

The only write-path change in Phase 2. `tryAllKeys()` in `app/api/youtube/search/route.ts` runs only on cache misses (inside `unstable_cache`), so incrementing there gives an accurate live-call count.

**Files:**
- Modify: `app/api/youtube/search/route.ts`
- Create: `app/api/youtube/search/route.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `app/api/youtube/search/route.test.ts`:

  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

  // ── mocks (hoisted so vi.mock factory can reference them) ──────────────────
  const { updateMock, refMock, dbMock, getAdminAppMock } = vi.hoisted(() => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const refMock = vi.fn().mockReturnValue({ update: updateMock });
    const dbMock = vi.fn().mockReturnValue({ ref: refMock });
    const getAdminAppMock = vi.fn().mockReturnValue({});
    return { updateMock, refMock, dbMock, getAdminAppMock };
  });

  vi.mock('firebase-admin/database', () => ({
    getDatabase: dbMock,
    ServerValue: { increment: (n: number) => ({ __increment: n }) },
  }));
  vi.mock('@/features/admin/lib/firebaseAdmin', () => ({
    getAdminApp: getAdminAppMock,
  }));
  // Make unstable_cache a transparent passthrough so tryAllKeys() runs directly
  vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  }));

  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    updateMock.mockReset().mockResolvedValue(undefined);
    refMock.mockReset().mockReturnValue({ update: updateMock });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Must import AFTER vi.mock() calls
  import { GET, __resetKeyCursorForTests } from './route';

  function youtubeResponse(items: unknown[] = [{ id: { videoId: 'v1' }, snippet: { title: 'T', channelTitle: 'C', thumbnails: { medium: { url: 'u' } } } }]): Response {
    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  describe('YouTube search BFF — quota counter', () => {
    beforeEach(() => {
      __resetKeyCursorForTests();
      process.env.YOUTUBE_API_KEYS = 'key-a';
      process.env.FIREBASE_ADMIN_PROJECT_ID = 'proj';
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'sa@proj.iam.gserviceaccount.com';
      process.env.FIREBASE_ADMIN_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----';
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = 'https://proj.firebaseio.com';
    });

    it('increments analytics/youtubeQuota/{date}/calls by 1 on a successful live call', async () => {
      fetchMock.mockResolvedValueOnce(youtubeResponse());
      const req = new Request('http://localhost/api/youtube/search?q=bolero');
      await GET(req);

      // ref points to the date node; update() writes the `calls` child
      expect(refMock).toHaveBeenCalledWith(
        expect.stringMatching(/^analytics\/youtubeQuota\/\d{8}$/),
      );
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ calls: { __increment: 1 } }),
      );
    });

    it('does not increment quota when all keys return 403', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
      const req = new Request('http://localhost/api/youtube/search?q=bolero');
      const res = await GET(req);
      expect(res.status).toBe(429);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('does not increment quota for a missing query', async () => {
      const req = new Request('http://localhost/api/youtube/search?q=');
      const res = await GET(req);
      expect(res.status).toBe(400);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('the date key uses PT timezone (America/Los_Angeles)', async () => {
      fetchMock.mockResolvedValueOnce(youtubeResponse());
      const req = new Request('http://localhost/api/youtube/search?q=nhac+tre');
      await GET(req);

      const ptDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
        .format(new Date())
        .replace(/-/g, '');

      expect(refMock).toHaveBeenCalledWith(`analytics/youtubeQuota/${ptDate}`);
    });
  });
  ```

- [ ] **Step 2: Run the tests to confirm they fail**

  ```bash
  npx vitest run app/api/youtube/search/route.test.ts
  ```

  Expected: all 4 tests fail (counter function doesn't exist yet).

- [ ] **Step 3: Add the quota counter to the search route**

  Open `app/api/youtube/search/route.ts`. Make these three additions — keep every existing line unchanged:

  **After the existing imports (after line 4), add:**
  ```typescript
  import { getDatabase, ServerValue } from 'firebase-admin/database';
  import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
  ```

  **After the `normalizeQuery` function (after line 21), add:**
  ```typescript
  function ptDateKey(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
      .format(new Date())
      .replace(/-/g, '');
  }

  function recordQuotaCall(): void {
    const db = getDatabase(getAdminApp());
    // ref to the date node; update() writes { calls: increment } as a child
    void db
      .ref(`analytics/youtubeQuota/${ptDateKey()}`)
      .update({ calls: ServerValue.increment(1) })
      .catch((err: unknown) => {
        console.warn('[youtube-bff] quota counter write failed:', err);
      });
  }
  ```

  **Inside `tryAllKeys()`, after `nextKeyIndex = i;` (currently line 89), add one line:**
  ```typescript
  nextKeyIndex = i;
  recordQuotaCall(); // fire-and-forget; never blocks or throws
  const data: { items?: YouTubeApiItem[] } = await res.json();
  ```

- [ ] **Step 4: Run the tests to confirm they pass**

  ```bash
  npx vitest run app/api/youtube/search/route.test.ts
  ```

  Expected: all 4 tests pass.

- [ ] **Step 5: Typecheck and lint**

  ```bash
  npx tsc --noEmit && npm run lint
  ```

  Expected: typecheck clean; no new lint errors beyond the 6 pre-existing ones.

- [ ] **Step 6: Commit**

  ```bash
  git add app/api/youtube/search/route.ts app/api/youtube/search/route.test.ts
  git commit -m "feat(admin): instrument youtube search BFF with per-day quota counter"
  ```

---

## Task 3: Stats API route

Reads the `rooms/*` RTDB subtree and returns KPIs + per-room rows. Admin-gated.

**Files:**
- Create: `app/api/admin/stats/route.ts`
- Create: `app/api/admin/stats/route.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `app/api/admin/stats/route.test.ts`:

  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  const { requireAdminMock, AdminAuthErrorMock, roomsOnceMock } = vi.hoisted(() => {
    class AdminAuthErrorMock extends Error {
      code: string;
      constructor(code: string) {
        super(code);
        this.name = 'AdminAuthError';
        this.code = code;
      }
    }
    const roomsOnceMock = vi.fn();
    const refMock = vi.fn().mockReturnValue({ once: roomsOnceMock });
    const dbMock = vi.fn().mockReturnValue({ ref: refMock });
    return {
      requireAdminMock: vi.fn(),
      AdminAuthErrorMock,
      roomsOnceMock,
      refMock,
      dbMock,
    };
  });

  vi.mock('@/features/admin/lib/requireAdmin', () => ({
    requireAdmin: requireAdminMock,
    AdminAuthError: AdminAuthErrorMock,
  }));
  vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn().mockReturnValue({ ref: vi.fn().mockReturnValue({ once: roomsOnceMock }) }) }));
  vi.mock('@/features/admin/lib/firebaseAdmin', () => ({ getAdminApp: vi.fn() }));

  import { GET } from './route';

  function makeSnap(val: unknown) {
    return { val: () => val, exists: () => val !== null };
  }

  const twoRooms = {
    '1234': {
      isTvActive: true,
      queue: { '-Nabc': { id: 'v1', title: 'Song A' }, '-Ndef': { id: 'v2', title: 'Song B' } },
      currentPlaying: { title: 'Song A' },
      lastEndedAt: null,
    },
    '5678': {
      isTvActive: false,
      queue: {},
      currentPlaying: null,
      lastEndedAt: 1_700_000_000_000,
    },
  };

  describe('GET /api/admin/stats', () => {
    beforeEach(() => {
      requireAdminMock.mockReset();
      roomsOnceMock.mockReset();
    });

    it('401 when requireAdmin throws no_cookie', async () => {
      requireAdminMock.mockRejectedValueOnce(new AdminAuthErrorMock('no_cookie'));
      const res = await GET();
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: 'no_cookie' });
      expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('returns correct KPIs for two rooms', async () => {
      requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
      roomsOnceMock.mockResolvedValueOnce(makeSnap(twoRooms));

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalRooms).toBe(2);
      expect(body.activeTvRooms).toBe(1);
      expect(body.totalQueueDepth).toBe(2);
    });

    it('returns per-room rows with correct fields', async () => {
      requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
      roomsOnceMock.mockResolvedValueOnce(makeSnap(twoRooms));

      const res = await GET();
      const body = await res.json();
      const room1234 = body.rooms.find((r: { roomId: string }) => r.roomId === '1234');
      expect(room1234).toMatchObject({
        roomId: '1234',
        queueDepth: 2,
        hasTv: true,
        currentSong: 'Song A',
        lastEndedAt: null,
      });
      const room5678 = body.rooms.find((r: { roomId: string }) => r.roomId === '5678');
      expect(room5678).toMatchObject({
        roomId: '5678',
        queueDepth: 0,
        hasTv: false,
        currentSong: null,
        lastEndedAt: 1_700_000_000_000,
      });
    });

    it('returns empty KPIs when rooms node is null', async () => {
      requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
      roomsOnceMock.mockResolvedValueOnce(makeSnap(null));

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalRooms).toBe(0);
      expect(body.rooms).toEqual([]);
    });

    it('500 when RTDB throws', async () => {
      requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
      roomsOnceMock.mockRejectedValueOnce(new Error('RTDB offline'));

      const res = await GET();
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ error: 'internal' });
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npx vitest run app/api/admin/stats/route.test.ts
  ```

  Expected: all 5 tests fail (file doesn't exist yet).

- [ ] **Step 3: Create the route**

  Create `app/api/admin/stats/route.ts`:

  ```typescript
  import { NextResponse } from 'next/server';
  import { getDatabase } from 'firebase-admin/database';
  import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
  import {
    requireAdmin,
    AdminAuthError,
  } from '@/features/admin/lib/requireAdmin';

  export const dynamic = 'force-dynamic';

  const NO_STORE = { 'Cache-Control': 'no-store' };

  export interface RoomRow {
    roomId: string;
    queueDepth: number;
    hasTv: boolean;
    currentSong: string | null;
    lastEndedAt: number | null;
  }

  export interface StatsSnapshot {
    totalRooms: number;
    activeTvRooms: number;
    totalQueueDepth: number;
    rooms: RoomRow[];
  }

  interface RtdbRoom {
    isTvActive?: boolean;
    queue?: Record<string, unknown>;
    currentPlaying?: { title?: string } | null;
    lastEndedAt?: number | null;
  }

  function adminDb() {
    return getDatabase(getAdminApp());
  }

  function unauth(err: unknown): NextResponse | null {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.code }, { status: 401, headers: NO_STORE });
    }
    return null;
  }

  export async function GET(): Promise<NextResponse> {
    try {
      await requireAdmin();
    } catch (err) {
      const r = unauth(err);
      if (r) return r;
      throw err;
    }

    let snap;
    try {
      snap = await adminDb().ref('rooms').once('value');
    } catch (err) {
      console.error('[api/admin/stats] RTDB read failed:', err);
      return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
    }

    const roomsVal: Record<string, RtdbRoom> =
      (snap.val() as Record<string, RtdbRoom> | null) ?? {};

    const rows: RoomRow[] = Object.entries(roomsVal).map(([roomId, room]) => ({
      roomId,
      queueDepth: Object.keys(room.queue ?? {}).length,
      hasTv: room.isTvActive === true,
      currentSong: room.currentPlaying?.title ?? null,
      lastEndedAt: room.lastEndedAt ?? null,
    }));

    const snapshot: StatsSnapshot = {
      totalRooms: rows.length,
      activeTvRooms: rows.filter((r) => r.hasTv).length,
      totalQueueDepth: rows.reduce((sum, r) => sum + r.queueDepth, 0),
      rooms: rows,
    };

    return NextResponse.json(snapshot, { status: 200, headers: NO_STORE });
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npx vitest run app/api/admin/stats/route.test.ts
  ```

  Expected: all 5 tests pass.

- [ ] **Step 5: Typecheck**

  ```bash
  npx tsc --noEmit
  ```

  Expected: clean.

- [ ] **Step 6: Commit**

  ```bash
  git add app/api/admin/stats/route.ts app/api/admin/stats/route.test.ts
  git commit -m "feat(admin): add stats API route (rooms KPIs)"
  ```

---

## Task 4: YouTube quota API route

Reads `analytics/youtubeQuota/*` from RTDB and returns the last 30 days of call counts bucketed by PT date.

**Files:**
- Create: `app/api/admin/quota/youtube/route.ts`
- Create: `app/api/admin/quota/youtube/route.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `app/api/admin/quota/youtube/route.test.ts`:

  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  const { requireAdminMock, AdminAuthErrorMock, quotaOnceMock } = vi.hoisted(() => {
    class AdminAuthErrorMock extends Error {
      code: string;
      constructor(code: string) {
        super(code);
        this.name = 'AdminAuthError';
        this.code = code;
      }
    }
    const quotaOnceMock = vi.fn();
    return { requireAdminMock: vi.fn(), AdminAuthErrorMock, quotaOnceMock };
  });

  vi.mock('@/features/admin/lib/requireAdmin', () => ({
    requireAdmin: requireAdminMock,
    AdminAuthError: AdminAuthErrorMock,
  }));
  vi.mock('firebase-admin/database', () => ({
    getDatabase: vi.fn().mockReturnValue({
      ref: vi.fn().mockReturnValue({ once: quotaOnceMock }),
    }),
  }));
  vi.mock('@/features/admin/lib/firebaseAdmin', () => ({ getAdminApp: vi.fn() }));

  import { GET } from './route';

  function makeSnap(val: unknown) {
    return { val: () => val };
  }

  describe('GET /api/admin/quota/youtube', () => {
    beforeEach(() => {
      requireAdminMock.mockReset();
      quotaOnceMock.mockReset();
    });

    it('401 when not authenticated', async () => {
      requireAdminMock.mockRejectedValueOnce(new AdminAuthErrorMock('no_cookie'));
      const res = await GET();
      expect(res.status).toBe(401);
      expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('returns 30 day entries sorted oldest to newest', async () => {
      requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
      quotaOnceMock.mockResolvedValueOnce(makeSnap(null));

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.days).toHaveLength(30);
      // dates should be in ascending order
      expect(body.days[0].date < body.days[29].date).toBe(true);
    });

    it('fills in calls from RTDB for matching date keys', async () => {
      requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });

      // Build a fake RTDB value with today's PT date
      const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
        .format(new Date())
        .replace(/-/g, '');
      quotaOnceMock.mockResolvedValueOnce(makeSnap({ [todayKey]: { calls: 42 } }));

      const res = await GET();
      const body = await res.json();
      const today = body.days.find((d: { date: string }) => d.date === todayKey);
      expect(today).toBeDefined();
      expect(today.calls).toBe(42);
    });

    it('returns calls: 0 for days with no data', async () => {
      requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
      quotaOnceMock.mockResolvedValueOnce(makeSnap({}));

      const res = await GET();
      const body = await res.json();
      expect(body.days.every((d: { calls: number }) => d.calls === 0)).toBe(true);
    });

    it('500 when RTDB throws', async () => {
      requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
      quotaOnceMock.mockRejectedValueOnce(new Error('network'));

      const res = await GET();
      expect(res.status).toBe(500);
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npx vitest run "app/api/admin/quota/youtube/route.test.ts"
  ```

  Expected: all 5 tests fail.

- [ ] **Step 3: Create the route**

  Create `app/api/admin/quota/youtube/route.ts`:

  ```typescript
  import { NextResponse } from 'next/server';
  import { getDatabase } from 'firebase-admin/database';
  import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
  import {
    requireAdmin,
    AdminAuthError,
  } from '@/features/admin/lib/requireAdmin';

  export const dynamic = 'force-dynamic';

  const NO_STORE = { 'Cache-Control': 'no-store' };

  export interface QuotaDay {
    date: string;  // YYYYMMDD in PT timezone
    calls: number;
  }

  export interface YoutubeQuotaSnapshot {
    days: QuotaDay[];
    dailyLimitCalls: number;
  }

  const DAILY_LIMIT_CALLS = 100; // 10,000 units / 100 units per search
  const DAYS_TO_SHOW = 30;

  function ptDateKey(daysAgo: number = 0): string {
    const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
      .format(d)
      .replace(/-/g, '');
  }

  function adminDb() {
    return getDatabase(getAdminApp());
  }

  function unauth(err: unknown): NextResponse | null {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.code }, { status: 401, headers: NO_STORE });
    }
    return null;
  }

  export async function GET(): Promise<NextResponse> {
    try {
      await requireAdmin();
    } catch (err) {
      const r = unauth(err);
      if (r) return r;
      throw err;
    }

    let snap;
    try {
      snap = await adminDb().ref('analytics/youtubeQuota').once('value');
    } catch (err) {
      console.error('[api/admin/quota/youtube] RTDB read failed:', err);
      return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
    }

    const rtdbVal: Record<string, { calls?: number }> =
      (snap.val() as Record<string, { calls?: number }> | null) ?? {};

    // Generate last DAYS_TO_SHOW date keys oldest → newest
    const days: QuotaDay[] = Array.from({ length: DAYS_TO_SHOW }, (_, i) => {
      const date = ptDateKey(DAYS_TO_SHOW - 1 - i);
      return { date, calls: rtdbVal[date]?.calls ?? 0 };
    });

    const result: YoutubeQuotaSnapshot = { days, dailyLimitCalls: DAILY_LIMIT_CALLS };
    return NextResponse.json(result, { status: 200, headers: NO_STORE });
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npx vitest run "app/api/admin/quota/youtube/route.test.ts"
  ```

  Expected: all 5 tests pass.

- [ ] **Step 5: Typecheck**

  ```bash
  npx tsc --noEmit
  ```

  Expected: clean.

- [ ] **Step 6: Commit**

  ```bash
  git add app/api/admin/quota/youtube/route.ts app/api/admin/quota/youtube/route.test.ts
  git commit -m "feat(admin): add youtube quota API route (last 30 PT days)"
  ```

---

## Task 5: useStatsSnapshot hook

Polls `/api/admin/stats` every 30 seconds. Pattern follows `useSubscriptions.ts` with an added `setInterval`.

**Files:**
- Create: `features/admin/hooks/useStatsSnapshot.ts`
- Create: `features/admin/hooks/useStatsSnapshot.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `features/admin/hooks/useStatsSnapshot.test.ts`:

  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
  import { renderHook, act } from '@testing-library/react';
  import { useStatsSnapshot } from './useStatsSnapshot';
  import type { StatsSnapshot } from '@/app/api/admin/stats/route';

  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function jsonRes(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const fakeSnapshot: StatsSnapshot = {
    totalRooms: 2,
    activeTvRooms: 1,
    totalQueueDepth: 3,
    rooms: [],
  };

  describe('useStatsSnapshot', () => {
    it('starts in loading state', () => {
      fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
      const { result } = renderHook(() => useStatsSnapshot());
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('populates data on 200', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes(200, fakeSnapshot));
      const { result } = renderHook(() => useStatsSnapshot());

      await act(async () => { await vi.runAllTimersAsync(); });
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(fakeSnapshot);
      expect(result.current.error).toBeNull();
    });

    it('sets error on non-200 response', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes(500, { error: 'internal' }));
      const { result } = renderHook(() => useStatsSnapshot());

      await act(async () => { await vi.runAllTimersAsync(); });
      expect(result.current.error).toBe('internal');
      expect(result.current.data).toBeNull();
    });

    it('sets error on network failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('net::ERR_FAILED'));
      const { result } = renderHook(() => useStatsSnapshot());

      await act(async () => { await vi.runAllTimersAsync(); });
      expect(result.current.error).toBe('net::ERR_FAILED');
    });

    it('re-fetches automatically after 30 seconds', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonRes(200, fakeSnapshot))
        .mockResolvedValueOnce(jsonRes(200, { ...fakeSnapshot, totalRooms: 5 }));

      const { result } = renderHook(() => useStatsSnapshot());

      await act(async () => { await vi.runAllTimersAsync(); });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.current.data?.totalRooms).toBe(2);

      await act(async () => {
        vi.advanceTimersByTime(30_000);
        await vi.runAllTimersAsync();
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.data?.totalRooms).toBe(5);
    });

    it('clears the interval on unmount', async () => {
      fetchMock.mockResolvedValue(jsonRes(200, fakeSnapshot));
      const { unmount } = renderHook(() => useStatsSnapshot());

      await act(async () => { await vi.runAllTimersAsync(); });
      unmount();

      vi.advanceTimersByTime(30_000);
      // No additional fetch after unmount
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npx vitest run features/admin/hooks/useStatsSnapshot.test.ts
  ```

  Expected: all 6 tests fail.

- [ ] **Step 3: Create the hook**

  Create `features/admin/hooks/useStatsSnapshot.ts`:

  ```typescript
  'use client';

  import { useEffect, useState } from 'react';
  import type { StatsSnapshot } from '@/app/api/admin/stats/route';

  const POLL_INTERVAL_MS = 30_000;

  interface UseStatsSnapshotResult {
    data: StatsSnapshot | null;
    loading: boolean;
    error: string | null;
  }

  export function useStatsSnapshot(): UseStatsSnapshotResult {
    const [data, setData] = useState<StatsSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;

      function doFetch() {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on each poll tick
        setLoading(true);
        setError(null);
        fetch('/api/admin/stats', { headers: { 'Cache-Control': 'no-store' } })
          .then(async (res) => {
            if (cancelled) return;
            if (!res.ok) {
              let msg = `HTTP ${res.status}`;
              try {
                const body = (await res.json()) as { error?: unknown };
                if (typeof body.error === 'string') msg = body.error;
              } catch { /* body wasn't JSON */ }
              setError(msg);
              setData(null);
              setLoading(false);
              return;
            }
            setData((await res.json()) as StatsSnapshot);
            setLoading(false);
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            setError(err instanceof Error ? err.message : 'network_error');
            setLoading(false);
          });
      }

      doFetch();
      const interval = setInterval(doFetch, POLL_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, []);

    return { data, loading, error };
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npx vitest run features/admin/hooks/useStatsSnapshot.test.ts
  ```

  Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add features/admin/hooks/useStatsSnapshot.ts features/admin/hooks/useStatsSnapshot.test.ts
  git commit -m "feat(admin): add useStatsSnapshot polling hook (30s)"
  ```

---

## Task 6: useYoutubeQuota hook

Polls `/api/admin/quota/youtube` every 60 seconds. Identical pattern to `useStatsSnapshot`.

**Files:**
- Create: `features/admin/hooks/useYoutubeQuota.ts`
- Create: `features/admin/hooks/useYoutubeQuota.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `features/admin/hooks/useYoutubeQuota.test.ts`:

  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
  import { renderHook, act } from '@testing-library/react';
  import { useYoutubeQuota } from './useYoutubeQuota';
  import type { YoutubeQuotaSnapshot } from '@/app/api/admin/quota/youtube/route';

  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function jsonRes(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const fakeQuota: YoutubeQuotaSnapshot = {
    dailyLimitCalls: 100,
    days: Array.from({ length: 30 }, (_, i) => ({
      date: `202601${String(i + 1).padStart(2, '0')}`,
      calls: i * 2,
    })),
  };

  describe('useYoutubeQuota', () => {
    it('starts in loading state', () => {
      fetchMock.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useYoutubeQuota());
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
    });

    it('populates data on 200', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes(200, fakeQuota));
      const { result } = renderHook(() => useYoutubeQuota());

      await act(async () => { await vi.runAllTimersAsync(); });
      expect(result.current.data).toEqual(fakeQuota);
      expect(result.current.loading).toBe(false);
    });

    it('sets error on non-200', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes(401, { error: 'no_cookie' }));
      const { result } = renderHook(() => useYoutubeQuota());

      await act(async () => { await vi.runAllTimersAsync(); });
      expect(result.current.error).toBe('no_cookie');
    });

    it('re-fetches after 60 seconds', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonRes(200, fakeQuota))
        .mockResolvedValueOnce(jsonRes(200, { ...fakeQuota, dailyLimitCalls: 200 }));

      const { result } = renderHook(() => useYoutubeQuota());
      await act(async () => { await vi.runAllTimersAsync(); });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await vi.runAllTimersAsync();
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.data?.dailyLimitCalls).toBe(200);
    });

    it('clears the interval on unmount', async () => {
      fetchMock.mockResolvedValue(jsonRes(200, fakeQuota));
      const { unmount } = renderHook(() => useYoutubeQuota());

      await act(async () => { await vi.runAllTimersAsync(); });
      unmount();
      vi.advanceTimersByTime(60_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npx vitest run features/admin/hooks/useYoutubeQuota.test.ts
  ```

  Expected: all 5 tests fail.

- [ ] **Step 3: Create the hook**

  Create `features/admin/hooks/useYoutubeQuota.ts`:

  ```typescript
  'use client';

  import { useEffect, useState } from 'react';
  import type { YoutubeQuotaSnapshot } from '@/app/api/admin/quota/youtube/route';

  const POLL_INTERVAL_MS = 60_000;

  interface UseYoutubeQuotaResult {
    data: YoutubeQuotaSnapshot | null;
    loading: boolean;
    error: string | null;
  }

  export function useYoutubeQuota(): UseYoutubeQuotaResult {
    const [data, setData] = useState<YoutubeQuotaSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;

      function doFetch() {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on each poll tick
        setLoading(true);
        setError(null);
        fetch('/api/admin/quota/youtube', { headers: { 'Cache-Control': 'no-store' } })
          .then(async (res) => {
            if (cancelled) return;
            if (!res.ok) {
              let msg = `HTTP ${res.status}`;
              try {
                const body = (await res.json()) as { error?: unknown };
                if (typeof body.error === 'string') msg = body.error;
              } catch { /* body wasn't JSON */ }
              setError(msg);
              setData(null);
              setLoading(false);
              return;
            }
            setData((await res.json()) as YoutubeQuotaSnapshot);
            setLoading(false);
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            setError(err instanceof Error ? err.message : 'network_error');
            setLoading(false);
          });
      }

      doFetch();
      const interval = setInterval(doFetch, POLL_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, []);

    return { data, loading, error };
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npx vitest run features/admin/hooks/useYoutubeQuota.test.ts
  ```

  Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add features/admin/hooks/useYoutubeQuota.ts features/admin/hooks/useYoutubeQuota.test.ts
  git commit -m "feat(admin): add useYoutubeQuota polling hook (60s)"
  ```

---

## Task 7: Presentational components

All four are purely presentational (no state/effects/logic branching worth testing independently). Each is pure Tailwind following existing admin component patterns.

**Files:**
- Create: `features/admin/components/StatCard.tsx`
- Create: `features/admin/components/RoomsTable.tsx`
- Create: `features/admin/components/QuotaChart.tsx`
- Create: `features/admin/components/WhitelistPanel.tsx`

- [ ] **Step 1: Create StatCard**

  Create `features/admin/components/StatCard.tsx`:

  ```typescript
  interface StatCardProps {
    label: string;
    value: number | string;
    sublabel?: string;
  }

  export function StatCard({ label, value, sublabel }: StatCardProps) {
    return (
      <div className="rounded-2xl border border-border bg-surface/60 backdrop-blur-md px-5 py-4 space-y-1">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
        <p className="text-3xl font-semibold text-fg">{value}</p>
        {sublabel && (
          <p className="text-xs text-muted">{sublabel}</p>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Create RoomsTable**

  Create `features/admin/components/RoomsTable.tsx`:

  ```typescript
  'use client';

  import { DataTable, type DataTableColumn } from './DataTable';
  import type { RoomRow } from '@/app/api/admin/stats/route';

  const COLUMNS: DataTableColumn<RoomRow>[] = [
    {
      key: 'roomId',
      label: 'Phòng',
      sortable: true,
      sortValue: (r) => r.roomId,
    },
    {
      key: 'hasTv',
      label: 'TV',
      render: (r) => (
        <span className={r.hasTv ? 'text-emerald-400' : 'text-muted'}>
          {r.hasTv ? 'Đang bật' : '—'}
        </span>
      ),
    },
    {
      key: 'queueDepth',
      label: 'Hàng chờ',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.queueDepth,
    },
    {
      key: 'currentSong',
      label: 'Đang phát',
      render: (r) => (
        <span className="truncate max-w-[240px] block text-muted">
          {r.currentSong ?? '—'}
        </span>
      ),
    },
    {
      key: 'lastEndedAt',
      label: 'Kết thúc lần cuối',
      render: (r) =>
        r.lastEndedAt
          ? new Date(r.lastEndedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
          : '—',
    },
  ];

  interface RoomsTableProps {
    rooms: RoomRow[];
  }

  export function RoomsTable({ rooms }: RoomsTableProps) {
    return (
      <DataTable
        columns={COLUMNS}
        data={rooms}
        defaultSortKey="roomId"
        defaultSortDir="asc"
        rowKey={(r) => r.roomId}
        emptyMessage="Không có phòng nào đang hoạt động."
      />
    );
  }
  ```

- [ ] **Step 3: Create QuotaChart**

  Create `features/admin/components/QuotaChart.tsx`:

  ```typescript
  import type { QuotaDay } from '@/app/api/admin/quota/youtube/route';

  interface QuotaChartProps {
    days: QuotaDay[];
    dailyLimitCalls: number;
  }

  function barColor(calls: number, limit: number): string {
    const pct = limit > 0 ? calls / limit : 0;
    if (pct >= 0.95) return 'bg-danger/70';
    if (pct >= 0.80) return 'bg-yellow-500/60';
    return 'bg-emerald-500/50';
  }

  export function QuotaChart({ days, dailyLimitCalls }: QuotaChartProps) {
    const maxCalls = Math.max(dailyLimitCalls, ...days.map((d) => d.calls), 1);

    return (
      <div className="space-y-2">
        <div className="flex items-end gap-0.5 h-28 w-full">
          {days.map((day) => {
            const heightPct = (day.calls / maxCalls) * 100;
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col justify-end"
                title={`${day.date}: ${day.calls} calls`}
              >
                <div
                  className={`rounded-t-sm transition-all ${barColor(day.calls, dailyLimitCalls)}`}
                  style={{ height: `${heightPct}%`, minHeight: day.calls > 0 ? '2px' : '0' }}
                />
              </div>
            );
          })}
        </div>
        {/* Show first, middle, and last date labels */}
        <div className="flex justify-between text-[10px] text-muted px-0.5">
          <span>{days[0]?.date ?? ''}</span>
          <span>{days[14]?.date ?? ''}</span>
          <span>{days[29]?.date ?? ''}</span>
        </div>
        <p className="text-xs text-muted">
          Giới hạn: {dailyLimitCalls} lượt/ngày (10,000 units). Múi giờ: PT.
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 4: Create WhitelistPanel**

  `WhitelistPanel` is a server component — no `'use client'` directive. It reads the env var at render time.

  Create `features/admin/components/WhitelistPanel.tsx`:

  ```typescript
  import { parseAdminEmails } from '@/features/admin/lib/requireAdmin';

  export function WhitelistPanel() {
    const emails = Array.from(parseAdminEmails(process.env.ADMIN_EMAILS)).sort();

    return (
      <section className="rounded-2xl border border-border bg-surface/60 backdrop-blur-md px-5 py-4 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Whitelist admin</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Danh sách email từ biến môi trường ADMIN_EMAILS. Chỉ đọc.
          </p>
        </div>
        {emails.length === 0 ? (
          <p className="text-sm text-danger">ADMIN_EMAILS chưa được cấu hình.</p>
        ) : (
          <ul className="space-y-1">
            {emails.map((email) => (
              <li key={email} className="text-sm text-fg font-mono">
                {email}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  ```

- [ ] **Step 5: Typecheck**

  ```bash
  npx tsc --noEmit
  ```

  Expected: clean.

- [ ] **Step 6: Commit**

  ```bash
  git add \
    features/admin/components/StatCard.tsx \
    features/admin/components/RoomsTable.tsx \
    features/admin/components/QuotaChart.tsx \
    features/admin/components/WhitelistPanel.tsx
  git commit -m "feat(admin): add StatCard, RoomsTable, QuotaChart, WhitelistPanel components"
  ```

---

## Task 8: StatsShell, stats page, and AdminNav update

Wire the hooks into a client boundary, create the server page, and add the nav link.

**Files:**
- Create: `features/admin/components/StatsShell.tsx`
- Create: `app/admin/(gated)/stats/page.tsx`
- Modify: `features/admin/components/AdminNav.tsx`

- [ ] **Step 1: Create StatsShell**

  Create `features/admin/components/StatsShell.tsx`:

  ```typescript
  'use client';

  import { useEffect, useState } from 'react';
  import { useStatsSnapshot } from '../hooks/useStatsSnapshot';
  import { useYoutubeQuota } from '../hooks/useYoutubeQuota';
  import { StatCard } from './StatCard';
  import { RoomsTable } from './RoomsTable';
  import { QuotaChart } from './QuotaChart';

  export function StatsShell() {
    const stats = useStatsSnapshot();
    const quota = useYoutubeQuota();

    // SSR hydration guard — avoid baking server-side timestamp into markup.
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount flag for hydration guard
      setMounted(true);
    }, []);

    if (!mounted || stats.loading) {
      return (
        <p className="text-sm text-muted" role="status">
          Đang tải…
        </p>
      );
    }

    if (stats.error) {
      return (
        <p className="text-sm text-danger" role="alert">
          Lỗi tải thống kê: {stats.error}
        </p>
      );
    }

    const s = stats.data!;

    return (
      <div className="space-y-8">
        {/* KPI cards */}
        <section aria-label="Chỉ số tổng quan" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Tổng số phòng" value={s.totalRooms} />
          <StatCard label="Phòng có TV" value={s.activeTvRooms} />
          <StatCard
            label="Tổng hàng chờ"
            value={s.totalQueueDepth}
            sublabel="Số bài trong tất cả phòng"
          />
        </section>

        {/* Rooms table */}
        <section aria-label="Danh sách phòng" className="space-y-3">
          <h2 className="text-sm font-medium text-fg">Phòng đang hoạt động</h2>
          <RoomsTable rooms={s.rooms} />
        </section>

        {/* YouTube quota chart */}
        <section aria-label="Quota YouTube" className="rounded-2xl border border-border bg-surface/60 backdrop-blur-md px-5 py-4 space-y-3">
          <div>
            <h2 className="text-sm font-medium text-fg">Quota YouTube API</h2>
            <p className="text-[11px] text-muted mt-0.5">30 ngày gần nhất · múi giờ PT</p>
          </div>
          {quota.loading && (
            <p className="text-xs text-muted">Đang tải…</p>
          )}
          {quota.error && (
            <p className="text-xs text-danger">Lỗi: {quota.error}</p>
          )}
          {quota.data && (
            <QuotaChart days={quota.data.days} dailyLimitCalls={quota.data.dailyLimitCalls} />
          )}
        </section>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create the stats page**

  Create `app/admin/(gated)/stats/page.tsx`:

  ```typescript
  import { WhitelistPanel } from '@/features/admin/components/WhitelistPanel';
  import { StatsShell } from '@/features/admin/components/StatsShell';

  export default function StatsPage() {
    return (
      <div className="px-6 py-8 space-y-8">
        <header>
          <h1 className="text-lg font-semibold tracking-wide">Thống kê</h1>
          <p className="mt-1 text-xs text-muted">
            Tổng quan phòng, quota API và danh sách whitelist.
          </p>
        </header>
        <WhitelistPanel />
        <StatsShell />
      </div>
    );
  }
  ```

- [ ] **Step 3: Add the nav link in AdminNav**

  Open `features/admin/components/AdminNav.tsx`. Find the `NAV_ITEMS` array (line 17). Add the stats entry and remove its commented-out placeholder:

  ```typescript
  const NAV_ITEMS: NavItem[] = [
    { href: '/admin/subscriptions', label: 'Gói đăng ký' },
    { href: '/admin/stats', label: 'Thống kê' },
    // Future:
    // { href: '/admin/rooms',           label: 'Phòng' },
    // { href: '/admin/devices',         label: 'Thiết bị' },
    // { href: '/admin/search',          label: 'Tìm kiếm' },
    // { href: '/admin/queue-ops',       label: 'Hàng chờ' },
    // { href: '/admin/quota/firebase',  label: 'Quota Firebase' },
    // { href: '/admin/quota/youtube',   label: 'Quota YouTube' },
    // { href: '/admin/whitelist',       label: 'Whitelist' },
    // { href: '/admin/trials',          label: 'Dùng thử' },
  ];
  ```

- [ ] **Step 4: Typecheck and lint**

  ```bash
  npx tsc --noEmit && npm run lint
  ```

  Expected: clean typecheck; no new lint errors.

- [ ] **Step 5: Run the full test suite**

  ```bash
  npm run test
  ```

  Expected: all existing tests pass plus all new tests. Only pre-existing VideoPlayer failure.

- [ ] **Step 6: Commit**

  ```bash
  git add \
    features/admin/components/StatsShell.tsx \
    app/admin/\(gated\)/stats/page.tsx \
    features/admin/components/AdminNav.tsx
  git commit -m "feat(admin): add stats page with KPI cards, rooms table, quota chart, whitelist"
  ```

---

## Task 9: Playwright E2E

Verify the page loads, the four sections are visible, and the nav link works. The test uses the existing Playwright config pattern (see `e2e/home.spec.ts`).

**Files:**
- Create: `e2e/admin-stats.spec.ts`

- [ ] **Step 1: Write the E2E test**

  Create `e2e/admin-stats.spec.ts`:

  ```typescript
  import { expect, test } from '@playwright/test';

  // Admin routes require a valid __session cookie. These tests assert the page
  // structure when unauthenticated (redirect to login) — full auth flow is an
  // integration concern beyond Phase 2 scope.
  test.describe('/admin/stats — unauthenticated', () => {
    test('redirects to /admin/login', async ({ page }) => {
      await page.goto('/admin/stats');
      await expect(page).toHaveURL(/\/admin\/login/, { timeout: 5_000 });
    });
  });

  test.describe('/admin/login page', () => {
    test('shows the login form', async ({ page }) => {
      await page.goto('/admin/login');
      await expect(page.getByRole('heading')).toBeVisible();
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Mật khẩu/i)).toBeVisible();
    });
  });
  ```

  > **Note:** Testing the authenticated stats page requires a live Firebase project with an admin account. Full authenticated E2E is deferred to a future test setup with seeded credentials. The unauthenticated redirect assertion verifies the auth gate is wired correctly.

- [ ] **Step 2: Run the E2E tests**

  ```bash
  npm run test:e2e -- --grep "admin"
  ```

  Expected: both tests pass (redirect to login, login form visible).

- [ ] **Step 3: Commit**

  ```bash
  git add e2e/admin-stats.spec.ts
  git commit -m "test(e2e): add admin stats redirect and login form assertions"
  ```

---

## Task 10: Final verification

- [ ] **Step 1: Full test suite**

  ```bash
  npm run test
  ```

  Expected output (no regressions):
  ```
  Test Files  1 failed | 65+ passed
       Tests  1 failed | 580+ passed
  ```
  The 1 failure is the pre-existing `VideoPlayer.test.tsx` issue unrelated to this branch.

- [ ] **Step 2: Typecheck**

  ```bash
  npx tsc --noEmit
  ```

  Expected: `(Bash completed with no output)` — zero errors.

- [ ] **Step 3: Lint**

  ```bash
  npm run lint
  ```

  Expected: only the 6 pre-existing errors in `EndScreenOverlay.tsx`, `RemoteClient.tsx`, `useFullscreenOwnership.ts`. Zero new errors.

- [ ] **Step 4: Full E2E suite**

  ```bash
  npm run test:e2e
  ```

  Expected: all tests pass including new admin-stats tests.

- [ ] **Step 5: Production build**

  ```bash
  npm run build
  ```

  Expected: exits 0. Verify `app/admin/(gated)/stats` appears in the build output as a dynamic route.

- [ ] **Step 6: Final commit (if any cleanup needed)**

  ```bash
  git status
  ```

  Expected: clean. If any stray files, add and commit with a `chore:` prefix.

---

## Verification checklist

```
✅ typecheck
✅ lint (no new errors)
✅ vitest (all new tests pass; 1 pre-existing VideoPlayer failure unchanged)
✅ playwright (redirect + login form)
✅ build
```

**Files changed (source):**
- `app/api/youtube/search/route.ts` — adds `ptDateKey()`, `recordQuotaCall()`, one call in `tryAllKeys()`
- `app/api/admin/stats/route.ts` — new; reads RTDB `rooms/*`, returns KPIs + rows
- `app/api/admin/quota/youtube/route.ts` — new; reads RTDB `analytics/youtubeQuota/*`, last 30 PT days
- `features/admin/hooks/useStatsSnapshot.ts` — new; polls stats every 30 s
- `features/admin/hooks/useYoutubeQuota.ts` — new; polls quota every 60 s
- `features/admin/components/StatCard.tsx` — new; KPI tile
- `features/admin/components/RoomsTable.tsx` — new; wraps DataTable for room rows
- `features/admin/components/QuotaChart.tsx` — new; Tailwind bar chart
- `features/admin/components/WhitelistPanel.tsx` — new; server component, reads env
- `features/admin/components/StatsShell.tsx` — new; client boundary wiring hooks → components
- `app/admin/(gated)/stats/page.tsx` — new; server page
- `features/admin/components/AdminNav.tsx` — adds Thống kê nav entry

**Files changed (tests):**
- `app/api/youtube/search/route.test.ts` — quota counter increments on live call, not on 403/empty-query
- `app/api/admin/stats/route.test.ts` — auth 401, KPI accuracy, per-room rows, empty rooms, RTDB error
- `app/api/admin/quota/youtube/route.test.ts` — auth 401, 30-day array, date key matching, zero-fill, RTDB error
- `features/admin/hooks/useStatsSnapshot.test.ts` — loading, data, error, polling at 30 s, cleanup
- `features/admin/hooks/useYoutubeQuota.test.ts` — loading, data, error, polling at 60 s, cleanup
- `e2e/admin-stats.spec.ts` — redirect to login, login form visible
