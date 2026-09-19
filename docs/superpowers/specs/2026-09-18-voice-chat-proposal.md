# BS Kara voice chat proposal

Status: original proposal, approved for the first implementation. See [implementation notes](../../voice-chat.md) for the shipped local scope, actual file map, and remaining device validation. The mockup itself remains simulated.
Date: 2026-09-18
Scope: the Next.js website, including phone browsers. Native Expo parity is a later phase.

## Proposed experience

Keep the existing room header, theme, typography, and four bottom tabs. Add a Manual / Voice Chat segmented control inside the Search view, above the active search interface. On desktop this controls the left column; the existing queue/player column remains visible. On mobile the conversation occupies the Search tab and has a bottom microphone dock above the existing navigation.

The inline mockup uses sample song titles and durations, a simulated microphone, a local sample queue, and no microphone permission or external requests. It demonstrates selection, confirmation, mode switching, queue inspection, and pause state. It is not connected to Firebase or an AI provider. The compact preview grows with the conversation; the production screen will use a scrollable transcript with a stable microphone dock inside the existing viewport layout.

A separate full-page voice route would provide a larger visual separation, but would require more handling for room, session, and queue continuity. A new fifth bottom tab is another option, but would crowd the current mobile navigation. The proposed segmented control preserves the established navigation and separates the two input experiences.

## Interaction flow

1. User joins a room through the existing room gate, then chooses Voice Chat.
2. User taps the microphone once to grant access and start a bounded conversation session. Merely opening the tab does not start recording.
3. Capture speech, show interim text, and finalize one utterance. Only final utterances can initiate actions.
4. Send the utterance and session/turn identifiers to the server. The server supplies trusted conversation context and available tools to the chosen model.
5. For a song request, the model proposes searchSongs(query). The server searches through the existing YouTube API/fallback behavior, then stores a numbered result snapshot with a searchId.
6. Return structured results to the UI. Display a small numbered list and speak a concise question. Use descriptions supported by actual metadata, without inventing song attributes.
7. After speech output ends, open a short follow-up listening window, provided the voice session is still active. Do not listen through the assistant's own speech in the first version.
8. A reply such as "the first one" proposes addSearchResult(searchId, position). Resolve it against that session's saved list, not a fresh search. Clarify ambiguous references or expired lists.
9. If requesterPromptEnabled is active and a requester is missing, collect that name by voice before submitting. Preserve the selected video while asking.
10. Check room access and action permission, then execute an idempotent queue command. Return the actual outcome: queued, started, rejected, or failed.
11. Update the conversation and let existing Firebase subscriptions update the shared queue and TV. Speak a confirmation derived from the completed action result.
12. Continue with another short listening window or return to mic-off after timeout. Stop capture/TTS on mode switch, tab exit, hidden page, room change, leave, or expired access.

Manual and Voice Chat have independent search results. Switching modes preserves both searches and the conversation for the current browser session. Microphone activity never survives a mode switch. Conversation state belongs to a session, while queue and playback belong to the room.

## State and ownership

Client states: idle, requestingPermission, listening, transcribing, thinking, searching, speaking, awaitingChoice, collectingRequester, executing, confirming, and error. A reducer owns transitions, so a late transcript cannot add a song after cancellation.

The view owns rendering. A conversation hook owns audio orchestration and cancellation. The server owns authoritative search snapshots, accepted tool calls, and completed action receipts.

The client stores only its view state and a bounded transcript for session continuity. Server-side records hold session ID, room binding, expiry, recent turns, pending question, result snapshots, turn/request IDs, and action results. Use a server-managed store such as an explicitly scoped Firebase Admin collection; do not use a module-level Map in a serverless deployment. Do not put private transcripts below rooms/{roomCode}, which is shared with room readers. Raw audio is transient by default.

Serialize turns per session and reject stale turn IDs. A request ID identifies one logical mutation, including across retries. On a timeout with an unknown outcome, retrieve that receipt before attempting another mutation. A stop action can cancel work not yet committed; it does not undo a completed queue change.

## Application boundary

Use the chosen provider SDK for a bounded function-calling loop. An MCP server is optional later and should wrap the same command service. Do not expose an arbitrary database-write or browser-control tool.

Initial tools: searchSongs, addSearchResult, and cancelPendingChoice. Then add setPlaybackState and skipSong after their playback outcomes and permissions are implemented. Clarifying questions are ordinary assistant replies, not database actions.

Bind room identity on the server from the validated session rather than letting the model select arbitrary room IDs. Tool input schemas constrain shape; the executor also validates list membership, bounds, room state, permissions, and business rules.

Existing React hooks cannot be imported into a Next.js API handler to perform mutations. Extract only the command logic needed for the selected scope into testable plain modules, with thin client/Admin adapters. Keep the existing manual experience compatible and avoid a broad queue rewrite.

## Current behavior that affects this feature

- useVoiceSearch is one-shot browser speech recognition with a default vi-VN language. It currently has no conversational turn orchestration and reduces recognition errors to a general stop.
- SearchPanel sends finalized speech directly to searchYouTube. Leave this manual dictation path working while Voice Chat gains its own session.
- searchYouTube in bk-web/lib/youtube/client.ts uses relative browser fetch URLs and fallback logic. A server tool needs reusable server search functions, not an import of this browser wrapper.
- addSongToQueue starts playback when the room is idle. Preserve this behavior initially and say "starting" instead of "added to queue" when that is the outcome.
- Some queue operations do not await writes or return receipts. Queue reorder also replaces push IDs with array-index keys. Deduplication receipts and pending actions must not rely on an index that can change after reorder.
- useAIVoice already provides Google TTS with a browser fallback, but browser speech synthesis is shared. Coordinate voice replies, previews, and the existing MC; do not let cancellation of one surface unexpectedly stop another.
- The checked-in database.rules.json permits broad writes for matching room codes. The room-access GET checks subscription/access eligibility but is not an authenticated command session. A client isHost flag or supplied room code is not sufficient authorization for an Admin-backed tool endpoint.

For the proposed server path, issue an expiring room-bound guest session after access validation; verify host identity using the existing Firebase host token. Enforce action capabilities in code on every mutation and rate-limit voice requests. Review actual deployed rules before deciding whether any direct client-write migration is required. Server-side checks secure the new endpoint but do not fix permissive direct database access by themselves.

## File map

Paths below are repository-relative. New paths are proposals, not existing files.

| File | Action | Responsibility |
| --- | --- | --- |
| bk-web/features/remote/RemoteClient.tsx | Update | Mount mode switch and VoiceChatPanel, retain conversation above conditional views, pass room state, stop voice on leave/timeout, and count valid voice turns as activity. |
| bk-web/features/remote/components/SearchModeSwitch.tsx | New | Accessible two-mode selector. |
| bk-web/features/remote/hooks/useSearchModeParam.ts | New | Validate/preserve mode=manual or mode=voice alongside current room and tab URL parameters. |
| bk-web/features/remote/components/VoiceChatPanel.tsx | New | Compose transcript, result rows, action receipts, and mic dock. |
| bk-web/features/remote/components/VoiceChatMessages.tsx | New | Render user/assistant messages, numbered result snapshots, and queue outcomes. |
| bk-web/features/remote/components/VoiceChatControls.tsx | New | Start/stop/replay, listening status, permission and timeout states. |
| bk-web/features/remote/hooks/useVoiceConversation.ts | New | Session lifecycle, turn state, recording/TTS coordination, cancellation, and mode continuity. |
| bk-web/features/remote/lib/voiceConversation.ts | New | Client reducer and view message types; keep DOM/audio concerns out of reducer. |
| bk-web/features/remote/hooks/useVoiceSearch.ts | Conditional update | Retain manual dictation; extract reusable recognition events only if it helps the selected browser adapter. |
| bk-web/features/remote/components/SearchPanel.tsx | Small update if needed | Accommodate the shared mode header without breaking scroll-coupled chrome or search focus. |
| bk-web/features/voice/server/session.ts | New | Expiring room-bound sessions, trusted result snapshots, request receipts, access checks. |
| bk-web/features/voice/server/agent.ts | New | Provider invocation, bounded tool loop, prompting, and normalized response events. |
| bk-web/features/voice/server/tools.ts | New | Tool schemas and allowlisted dispatch through validated command handlers. |
| bk-web/app/api/voice/session/route.ts | New | Start/end an authorized conversation session. |
| bk-web/app/api/voice/turn/route.ts | New | Accept finalized text/turn identifiers and return structured conversation events. |
| bk-web/app/api/voice/transcribe/route.ts | New for cloud STT | Accept short audio turns with size/duration limits and return transcription; long-lived streaming needs a separately chosen transport. |
| bk-web/lib/youtube/server.ts | New | Reusable server search with existing key rotation, caching, quota reporting, and fallback behavior. |
| bk-web/app/api/youtube/search/route.ts | Update | Delegate existing public API behavior to extracted server search logic. |
| bk-web/app/api/search/route.ts | Update | Delegate scraper behavior without changing its existing response contract. |
| bk-shared/src/lib/roomCommands.ts | New, narrow extraction | Pure queue command planning and typed outcomes reusable by client and server adapters. |
| bk-shared/src/hooks/useRoom/queue.ts | Update | Await command writes, return explicit outcomes, preserve manual behavior and MC generation. |
| bk-web/features/voice/server/commands.ts | New | Authorized Admin adapter, atomic command/receipt execution, and actual queue/idle outcomes. |
| bk-web/hooks/useAIVoice.ts | Update | Reliable cancellation and completion suitable for turn-taking; language selection for English replies when enabled. |
| bk-web/app/api/tts/route.ts | Reuse initially | Existing Vietnamese speech output; add language-specific voices only when English output is enabled. |
| bk-shared/src/locales/vi.json and en.json | Update | Mode labels, voice statuses, error recovery, confirmation strings. |
| bk-web/package.json and pnpm-lock.yaml | Update | Chosen provider SDK and any necessary validation dependency. |
| database.rules.json and bk-web/tests/rules/database-rules.test.ts | Review/scoped update | Protect any new private session paths, preserve queue schema rules, and verify client access contracts. |
| e2e/voice-chat.spec.ts | New | Voice flow with deterministic audio/model stubs and actual UI/state assertions. |

Keep TopBar and BottomNav unchanged for the proposed navigation. The existing useTabParam hook still owns its four tabs. No TVClient change is required for initial search/queue behavior: Firebase already propagates changes. Accurate "paused on TV" acknowledgment and more advanced playback controls may later require TVClient and the player hook to expose command acknowledgment, rather than confirming only the database write.

## Implementation order and exit checks

1. UI and state: implement the mode switch, transcript, numbered rows, mic dock, and reducer with fixture responses. Verify both themes, 320px phone width, desktop two-column layout, keyboard access, and mode persistence. Manual search/queue tests continue passing.
2. Session and command boundary: implement validated session issuance, saved search snapshots, and authoritative idempotent action results. Test stale selection, out-of-range position, two guests, repeated requests, unknown write outcomes, idle playback, requester collection, and expired room access.
3. Text function calling: connect one provider through the server-only SDK. Replay text requests for search, refinement, selection, cancellation, and ambiguous choices. Confirm no tool can affect another session's room/results and no success message precedes a committed result.
4. Voice input/output: connect a cloud transcription adapter, use current TTS, add permission and no-speech recovery, then bounded automatic follow-up listening. Evaluate Vietnamese regional accents and mixed English titles with real recordings. Browser recognition can remain an optional adapter.
5. Playback commands: add explicit pause/resume and permitted skip, test concurrent controls, expose actual player acknowledgment if claiming playback success, and coordinate MC output. Defer volume/seek until the current player contract supports them.
6. Production validation: run focused Vitest tests, database-rule tests if changed, and Playwright voice/manual regressions; then perform real iOS Safari/Android Chrome microphone and noisy-room checks. Track intent correctness, wrong actions, task completion latency, and cost per completed interaction.

Proposed first release includes search, clarification, selection, optional requester name, queue confirmation, and switching modes. Voice pause/resume follows the playback verification step. Always-listening wake words, cross-device chat history, native Expo changes, MCP exposure, and queue-wide destructive commands are later work.

## Mockup verification

The standalone mockup was checked with Playwright at 320px, 390px, and 1024px browser widths. The product surface had no horizontal overflow at those sizes. Simulated first-result selection updated the sample queue, and switching manual/voice preserved the selected conversation. This verifies the mockup only, not speech recognition, real Firebase writes, provider accuracy, or device microphone behavior.
