import type { VoiceMessage, VoiceResults, VoiceSessionCredentials, VoiceTurnRequest, VoiceTurnResponse } from './types';

export interface VoiceDependencies {
  createSession(signal: AbortSignal): Promise<VoiceSessionCredentials>;
  capture(options: { signal: AbortSignal; onListening: () => void }): Promise<Blob>;
  transcribe(session: VoiceSessionCredentials, audio: Blob, signal: AbortSignal): Promise<string>;
  turn(session: VoiceSessionCredentials, body: VoiceTurnRequest, signal: AbortSignal): Promise<VoiceTurnResponse>;
  speak(text: string, signal: AbortSignal): Promise<void>;
  prime(): void;
  id(): string;
}
export type VoicePhase = 'idle' | 'permission' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
export interface ConversationSnapshot {
  messages: VoiceMessage[];
  phase: VoicePhase;
  error: string | null;
  canRetry: boolean;
  results: VoiceResults | null;
}

export class VoiceConversation {
  private snapshot: ConversationSnapshot = { messages: [], phase: 'idle', error: null, canRetry: false, results: null };
  private listeners = new Set<() => void>();
  private session: VoiceSessionCredentials | null = null;
  private controller: AbortController | null = null;
  private pending: Omit<VoiceTurnRequest, 'sessionId'> | null = null;
  private submitted = false;
  private automatic = false;
  private remainingTurns = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private deps: VoiceDependencies) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ConversationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private add(message: VoiceMessage) { this.update({ messages: [...this.snapshot.messages.slice(-39), message] }); }
  private async credentials(signal: AbortSignal) {
    if (!this.session) {
      const session = await this.deps.createSession(signal);
      signal.throwIfAborted();
      this.session = session;
    }
    return this.session;
  }
  private failure(error: unknown, fallback = 'network') {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : fallback;
    if (['invalid_session', 'session_expired', 'room_unavailable'].includes(code)) {
      this.session = null;
      this.update({ results: null });
    }
    this.automatic = false;
    this.update({ phase: 'idle', error: code, canRetry: !!this.pending });
  }
  stop = () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.automatic = false;
    this.controller?.abort();
    this.controller = null;
    this.update({ phase: 'idle', canRetry: !!this.pending, error: this.pending ? 'interrupted' : null });
  };
  private followUp() {
    if (!this.automatic || this.remainingTurns <= 0) return;
    this.timer = setTimeout(() => { this.timer = null; void this.listen(); }, 350);
  }
  start = async () => {
    if (this.snapshot.phase !== 'idle' || this.pending) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deps.prime();
    this.automatic = true;
    this.remainingTurns = 4;
    await this.listen();
  };
  private async listen() {
    const controller = new AbortController();
    this.controller = controller;
    const { signal } = controller;
    this.remainingTurns--;
    this.update({ phase: 'permission', error: null });
    try {
      // Request the microphone from the user gesture before network work.
      const audio = await this.deps.capture({ signal, onListening: () => { if (!signal.aborted) this.update({ phase: 'listening' }); } });
      signal.throwIfAborted();
      this.update({ phase: 'transcribing' });
      const session = await this.credentials(signal);
      const text = (await this.deps.transcribe(session, audio, signal)).trim();
      signal.throwIfAborted();
      if (!text) { this.failure({ code: 'noSpeech' }); return; }
      this.controller = null;
      this.update({ phase: 'idle' });
      await this.submitText(text, true);
    } catch (error) {
      if (!signal.aborted) this.failure(error);
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }
  submitText = async (text: string, fromVoice = false) => {
    if (this.pending || this.snapshot.phase !== 'idle' || !text.trim()) return;
    if (!fromVoice) this.automatic = false;
    this.pending = { requestId: this.deps.id(), text: text.trim().slice(0, 1000) };
    this.add({ id: this.pending.requestId, role: 'user', text: this.pending.text! });
    await this.execute();
  };
  select = async (searchId: string, position: number) => {
    const results = this.snapshot.results;
    if (!results || searchId !== results.searchId || !Number.isInteger(position) || position < 1 || position > results.videos.length) {
      this.update({ error: 'staleSelection' });
      return;
    }
    if (this.pending) return;
    // A touch choice interrupts listening/speaking without losing the snapshot.
    this.stop();
    this.deps.prime();
    this.pending = { requestId: this.deps.id(), selection: { searchId, position } };
    this.add({ id: this.pending.requestId, role: 'user', text: `${position}. ${results.videos[position - 1].title}` });
    await this.execute();
  };
  retry = async () => { if (this.pending && this.snapshot.phase === 'idle') await this.execute(); };
  private async execute() {
    if (!this.pending) return;
    const controller = new AbortController();
    this.controller = controller;
    const { signal } = controller;
    this.update({ phase: 'thinking', error: null, canRetry: false });
    try {
      const session = await this.credentials(signal);
      this.submitted = true;
      const response = await this.deps.turn(session, { ...this.pending, sessionId: session.sessionId }, signal);
      signal.throwIfAborted();
      this.pending = null;
      this.submitted = false;
      this.update({ results: response.results ?? (response.receipt || response.clearResults ? null : this.snapshot.results), canRetry: false });
      this.add({ id: this.deps.id(), role: 'assistant', text: response.reply, results: response.results, receipt: response.receipt });
      this.update({ phase: 'speaking' });
      try { await this.deps.speak(response.reply, signal); }
      catch (error) { if (!signal.aborted) this.failure(error, 'speech'); return; }
      signal.throwIfAborted();
      this.update({ phase: 'idle' });
      this.followUp();
    } catch (error) {
      if (signal.aborted) return;
      const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      // Definitive rejection is safe to replace. Network/5xx outcomes must be reconciled using the same request ID.
      if ([400, 401, 403, 404, 410, 422].includes(status) || ['invalid_selection', 'request_conflict', 'command_rejected'].includes(code) || !this.submitted) {
        this.pending = null;
        this.submitted = false;
        if ([401, 403, 410].includes(status)) this.session = null;
        if (code === 'invalid_selection' || [401, 403, 410].includes(status)) this.update({ results: null });
      }
      this.failure(error);
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }
  replay = async () => {
    if (this.pending) return;
    const last = this.snapshot.messages.findLast(message => message.role === 'assistant');
    if (!last) return;
    this.stop();
    this.deps.prime();
    const controller = new AbortController();
    this.controller = controller;
    this.update({ phase: 'speaking' });
    try { await this.deps.speak(last.text, controller.signal); if (!controller.signal.aborted) this.update({ phase: 'idle' }); }
    catch (error) { if (!controller.signal.aborted) this.failure(error, 'speech'); }
    finally { if (this.controller === controller) this.controller = null; }
  };
}
