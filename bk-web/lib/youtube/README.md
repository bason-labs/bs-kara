# lib/youtube/

YouTube domain. `types.ts` is the shared shape (server + client safe).
`client.ts` is the browser-only `searchYouTube` — it calls `/api/...` via a
relative URL, so route handlers must import only from `types.ts`.
