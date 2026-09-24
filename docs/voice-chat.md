# Voice Chat Mode

The website separates Manual and Voice Chat inside the Search tab when the host enables **Voice Chat mode** in Settings. The setting is off by default, so existing rooms show Manual search without the mode selector. Turning it off while Voice Chat is active stops capture and speech, returns the UI and URL to Manual, and prevents new voice API calls. Manual search remains mounted; switching modes retains its results and the voice transcript. Conversation state resets on room/language changes or page reload. This release does not add MCP, wake words, native-app support, or voice playback controls.

## Flow

1. Join an existing room and select Voice Chat. Opening the panel does not enable the microphone.
2. Tap the mic. MediaRecorder captures one utterance with echo cancellation and noise suppression, ending after 1.2 seconds of silence or 15 seconds total. Seven seconds without speech stops the attempt.
3. The server issues a room-bound session after checking guest subscription access or verified host ownership. The browser uploads audio to the authenticated transcription endpoint.
4. OpenAI Whisper transcribes the audio. OpenAI function calling selects one allowlisted action: search, choose result, save requester, cancel selection, or clarify. The executor validates every argument independently.
5. Search returns up to five numbered results from the existing YouTube API/scraper adapter. The server saves the exact snapshot for five minutes.
6. After speech output finishes, follow-up recording starts. Saying "the first one" resolves against the saved list. Tapping a numbered result is also supported. Up to four utterances run per mic activation.
7. If the room requires a singer name, the selected video stays pending while the assistant asks for it.
8. An atomic Firebase Admin transaction queues the trusted video, or starts it when the room is idle. Only the committed receipt generates a success confirmation. Existing Firebase listeners update the queue/TV.

Stop cancels local capture, network waiting, and speech. It cannot undo a server write already submitted. An uncertain turn is retried with its original request ID before another action is allowed, preventing duplicate additions. Old result buttons become inactive once consumed or replaced.

## Configuration

- Node.js 22 or newer. New server dependencies are `openai` for transcription/function calling and `music-metadata` for preflight audio-duration validation.
- Server environment: `OPENAI_API_KEY`, `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, and the existing `NEXT_PUBLIC_FIREBASE_DATABASE_URL`.
- Existing YouTube API configuration is reused, including scraper fallback. Vietnamese replies reuse `/api/tts` and its Google TTS configuration, with browser speech fallback. English replies use browser speech synthesis.
- Models: `whisper-1` for transcription and `gpt-4o-mini` for strict function calling. Provider calls have a 20-second timeout and SDK retries are disabled; application retries preserve request identity.
- Microphone access requires HTTPS or localhost. Opening the site by a plain HTTP LAN address will not work reliably for microphone testing.
- Room field `voiceChatEnabled` must be exactly `true` for Voice Chat to appear or for the server to create/authenticate a voice session. Missing and `false` values are disabled.

No environment values are exposed in the transcript. No production deployment or live provider/queue test was performed as part of implementation.

## Storage and Limits

Private records live under `voiceSessions/sessions/{sessionId}`, outside public rooms. Tokens are stored only as SHA-256 hashes. Sessions expire after 30 minutes; new session requests opportunistically delete up to 20 expired records. Expiration is not a guaranteed physical-deletion deadline; a scheduled cleanup is appropriate for production retention requirements. Raw audio is forwarded, not stored by this app; provider retention policies still apply.

The server keeps up to 12 recent conversation messages for intent context and bounded request receipts for replay. Public room `voiceReceipts` is an immutable-to-clients JSON string containing only opaque action keys, outcome, and expiry, not bearer tokens or transcripts. The scalar format permits a parent-level equality rule that also rejects deletion. Audio uploads are limited to 2 MiB and parsed locally; invalid containers or recordings over 45 seconds are rejected before a provider call. A provider-owned client-address header limits unauthenticated session attempts, while shared room/global quotas are charged only after access succeeds. Per-room and shared counters use independent keys with expiry cleanup; configure provider spend limits separately.

**Deploy the updated database rules before enabling Voice Chat in production.** They protect the receipt ledger from client modification/deletion, deny private-session access, and index session/counter expiry. No rules have been deployed by this task. The emulator configuration now lives at the repository root beside the actual rules file; the previous web-local config referenced a missing file.

Existing room fields still permit broad direct writes. The voice API adds its own access checks but does not harden all those older client paths. Review actual deployed rules rather than blindly replacing a newer production ruleset. Cost-abuse protection beyond room codes, device testing, and privacy/retention review remain release checks.

## File Map

| Area | Files |
| --- | --- |
| Mode integration | `apps/web/features/remote/RemoteClient.tsx`, `components/SearchPanel.tsx`, `components/SearchModeSwitch.tsx`, `hooks/useSearchModeParam.ts` |
| Voice panel and lifecycle | `apps/web/features/remote/components/VoiceChatPanel.tsx`, `hooks/useVoiceConversation.ts` |
| Client orchestration and audio | `apps/web/features/voice/conversation.ts`, `client.ts`, `audio.ts`, `types.ts` |
| Intent, authorization, queue transactions | `apps/web/features/voice/server/agent.ts`, `service.ts`, `http.ts` |
| HTTP endpoints | `apps/web/app/api/voice/{session,turn,transcribe}/route.ts` |
| Reused server search | `apps/web/server/youtube.ts`, existing search route adapters |
| Labels | `packages/shared/src/locales/{en,vi}.json` |
| Database protection | `database.rules.json`, root `firebase.json`, `apps/web/tests/rules/database-rules.test.ts` |
| Verification | Colocated unit/component tests and `e2e/voice-chat.spec.ts` |

The original proposal listed more separate components and a shared queue refactor. This implementation keeps the small panel together and adds a server queue adapter without changing existing manual queue hooks. MC announcements retain the existing TV-side fallback for songs without prefetched MC text.

## Verification and Rollout

Run `pnpm -C apps/web test`, `pnpm -C apps/web typecheck`, `pnpm -C apps/web lint`, and `pnpm -C apps/web build`. Run database checks with `pnpm -C apps/web test:rules:emulator` (demo project only). Run deterministic browser checks with `pnpm exec playwright test --project=chromium --grep-invert @live`, and voice-only cross-browser checks with `pnpm exec playwright test e2e/voice-chat.spec.ts`.

Voice browser tests stub Firebase transport, API responses, microphone, and speech output. They verify UI orchestration, not real intent accuracy or acoustic performance. Before release, test an authorized disposable room with real Vietnamese/English utterances, accents, music playing, denied permissions, iOS Safari, Android Chrome, and repeated network interruptions. Check latency, wrong selections, cost, and actual TV updates.
