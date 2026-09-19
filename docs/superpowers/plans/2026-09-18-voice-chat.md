# Voice Chat Implementation Plan

**Goal:** Ship the approved website flow: spoken search, numbered selection, queue action, and spoken confirmation.
**Architecture:** Keep manual search mounted separately from voice chat. A client conversation controller coordinates microphone capture and TTS. Server-only OpenAI tool calling uses persisted room-bound sessions and validated search snapshots; queue writes return idempotent outcomes. Existing room subscriptions propagate the result.
**Tech stack:** Next.js, React, Firebase Admin/RTDB, OpenAI SDK, MediaRecorder, existing Google TTS, Vitest and Playwright.
**Spec:** ../specs/2026-09-18-voice-chat-proposal.md

## Constraints

- Website only. Do not change the native app or deploy anything.
- No MCP, wake word, or new playback commands in this release.
- Preserve manual search, requester settings, theme, room identity, and queue behavior.
- Keep API credentials and authoritative snapshots on the server.
- Stop microphone and speech on exit, hidden page, inactivity, or cancellation.

## Tasks

1. [x] Backend: add tests for session authentication, trusted result selection, expiration, request replay, missing configuration, and empty/invalid input. Implement session/turn/transcribe routes and server command modules using shared `features/voice/types.ts` contracts. Return a committed `VoiceReceipt`, never a speculative success.
2. [x] Conversation: test result preservation, failed turn retry, late-response cancellation, session lifecycle, and microphone cleanup. Implement client API and `useVoiceConversation` with final transcripts, one request at a time, bounded listening, and TTS completion before follow-up capture.
3. [x] UI: add Manual / Voice Chat switch and panel in the existing search column, respecting mobile header padding and desktop layout. Keep manual search mounted. Add locale strings and keyboard-accessible number selection with captured `searchId`.
4. [x] Integration: add Playwright tests with HTTP/audio boundary stubs, verify the real UI search/select flow and persistence through switching, plus stop/cancellation. Inspect screenshots on mobile and desktop.
5. [x] Verification: run web typecheck, lint, Vitest, relevant Playwright regressions, and production build. Start the dev server on a free port and document provider/session configuration and any unverified live-device behavior.

## API Contracts

`POST /api/voice/session`: `{roomCode, language: 'vi' | 'en', idToken?: string}` -> `{sessionId, token}`. Verify a supplied host ID token and room ownership; otherwise apply the current guest room-access subscription gate.

`POST /api/voice/turn`: bearer session token plus `{sessionId, requestId, text?: string, selection?: {searchId, position}}` -> `VoiceTurnResponse`. Accept exactly one input mode. Positions are one-based. Return `{error: string}` with a meaningful non-2xx status on failure.

`POST /api/voice/transcribe`: bearer session token and multipart `sessionId`, `audio` -> `{text: string}`. Reject oversized or unsupported inputs before calling OpenAI. Raw audio is not persisted.

`VoiceTurnResponse` contains `reply` plus optional `results: {searchId, videos}` and/or `receipt: {status: 'queued' | 'started', video}`. Each action is scoped to the server session and request ID. Results and action receipts are rendered as data, never executable HTML.

## Execution

Backend files and their tests are delegated under the parallel-agent skill. UI/audio files and their tests remain with the main agent. Review both together before final verification. No commits or publishing are part of this request.
