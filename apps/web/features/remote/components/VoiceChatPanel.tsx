'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import Image from 'next/image';
import { AudioLines, CheckCircle2, ChevronRight, LoaderCircle, Mic, Music2, RotateCcw, Square, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { YouTubeVideo } from '@bs-kara/shared';
import type { VoiceConversation } from '@/features/voice/conversation';

interface VoiceChatPanelProps {
  conversation: VoiceConversation;
  active: boolean;
  modeSwitch: ReactNode;
  currentPlaying?: YouTubeVideo | null;
}

const errorKeys: Record<string, string> = {
  permission: 'permission', unsupported: 'unsupported', noSpeech: 'noSpeech', recording: 'recording',
  speech: 'speech', interrupted: 'interrupted', staleSelection: 'staleSelection',
  invalid_selection: 'staleSelection', command_rejected: 'staleSelection', turn_pending: 'interrupted', request_conflict: 'interrupted',
  session_expired: 'session', invalid_session: 'session', room_unavailable: 'session',
  rate_limited: 'rateLimit', not_configured: 'configuration', voice_unavailable: 'configuration',
};

export function VoiceChatPanel({ conversation, active, modeSwitch, currentPlaying }: VoiceChatPanelProps) {
  const { t } = useTranslation();
  const state = useSyncExternalStore(conversation.subscribe, conversation.getSnapshot, conversation.getSnapshot);
  const transcript = useRef<HTMLDivElement>(null);
  const busy = state.phase !== 'idle';
  useEffect(() => {
    if (!active) conversation.stop();
    const onVisibility = () => { if (document.hidden) conversation.stop(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); conversation.stop(); };
  }, [active, conversation]);
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [state.messages, state.error]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg pt-[var(--header-h)] lg:pt-0" aria-label={t('voiceChat.voice')}>
      <div className="shrink-0">{modeSwitch}</div>
      {currentPlaying && <div className="mx-4 flex shrink-0 items-center gap-3 border-b border-border py-3">
        <Music2 size={20} className="shrink-0 text-brand dark:text-accent" aria-hidden />
        <div className="min-w-0"><p className="text-xs text-muted">{t('voiceChat.currentSong')}</p><p className="truncate text-xs font-medium">{currentPlaying.title}</p></div>
      </div>}
      <div ref={transcript} role="log" aria-label={t('voiceChat.conversation')} aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <p className="mb-5 text-xs text-muted">{t('voiceChat.conversation')}</p>
        {state.messages.length === 0 && <div className="py-8"><AudioLines size={28} className="mb-4 text-brand dark:text-accent" aria-hidden /><p className="text-lg font-semibold">{t('voiceChat.welcome')}</p></div>}
        {state.messages.map(message => <div key={message.id} className="mb-5">
          {message.role === 'user' ? <p className="ml-auto w-fit max-w-[88%] break-words rounded-lg bg-brand/10 px-3 py-2.5 text-sm dark:bg-surface-3">{message.text}</p> : <>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand dark:text-accent"><AudioLines size={14} aria-hidden />Kara</div>
            <p className="break-words text-sm leading-relaxed">{message.text}</p>
            {message.results && <ol className="mt-3 divide-y divide-border border-y border-border">{message.results.videos.map((video, index) => <li key={`${video.id}-${index}`}>
              <button type="button" aria-label={`${index + 1}. ${video.title}`} disabled={state.results?.searchId !== message.results?.searchId || state.canRetry || state.phase === 'thinking' || state.phase === 'transcribing'} onClick={() => void conversation.select(message.results!.searchId, index + 1)} className="flex min-h-20 w-full items-center gap-3 py-3 text-left disabled:opacity-50">
                <span className="w-5 shrink-0 text-lg font-semibold tabular-nums text-brand dark:text-accent">{index + 1}</span>
                {video.thumbnail && <Image src={video.thumbnail} alt="" width={72} height={48} unoptimized className="h-12 w-[72px] shrink-0 rounded object-cover max-[360px]:hidden" />}
                <span className="min-w-0 flex-1"><span className="line-clamp-2 break-words text-sm font-medium">{video.title}</span><span className="mt-1 block truncate text-xs text-muted">{video.channel}{video.duration ? ` · ${video.duration}` : ''}</span></span>
                <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
              </button>
            </li>)}</ol>}
            {message.receipt && <div className="mt-3 flex items-center gap-2 text-xs text-brand dark:text-accent"><CheckCircle2 size={16} aria-hidden />{t(message.receipt.status === 'queued' ? 'voiceChat.queued' : 'voiceChat.started')}</div>}
          </>}
        </div>)}
      </div>
      <div className="shrink-0 border-t border-border bg-surface px-4 pb-4 pt-3 text-center">
        {state.error && <p role="alert" className="mb-3 text-sm text-danger">{t(`voiceChat.errors.${errorKeys[state.error] ?? 'network'}`)}</p>}
        {state.canRetry && <button type="button" onClick={() => void conversation.retry()} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand dark:text-accent"><RotateCcw size={17} aria-hidden />{t('voiceChat.retry')}</button>}
        <p role="status" className="text-xs font-medium text-muted">{t(`voiceChat.status.${state.phase}`)}</p>
        <div className="mt-3 flex items-center justify-center gap-7">
          <button type="button" title={t('voiceChat.replay')} aria-label={t('voiceChat.replay')} disabled={!state.messages.some(m => m.role === 'assistant') || state.canRetry} onClick={() => void conversation.replay()} className="flex h-11 w-11 items-center justify-center rounded-full text-muted disabled:opacity-40"><Volume2 size={20} /></button>
          <button type="button" title={t('voiceChat.start')} aria-label={t('voiceChat.start')} disabled={busy || state.canRetry || !active} onClick={() => void conversation.start()} className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white disabled:opacity-50">
            {busy && state.phase !== 'listening' ? <LoaderCircle size={26} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Mic size={26} aria-hidden />}
          </button>
          <button type="button" title={t('voiceChat.stop')} aria-label={t('voiceChat.stop')} onClick={conversation.stop} className="flex h-11 w-11 items-center justify-center rounded-full text-muted"><Square size={20} /></button>
        </div>
      </div>
    </div>
  );
}
