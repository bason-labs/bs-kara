# server/

Server-only code shared by several route handlers. Every module here either imports
`server-only` or is only reachable from one that does, so none of it can end up in a
client bundle.

- Route handlers in `app/api/**/route.ts` stay thin: parse the request, call a module
  here, map the result to a `NextResponse`.
- Server code that belongs to a single feature stays with that feature
  (`features/voice/server/`).
- Types that client code also needs (API contracts) live in `lib/`, e.g. `lib/roomAccess.ts`.
