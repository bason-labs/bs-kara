'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { RegisteredUser } from '@bs-kara/shared/registered-users';
import { NeonOrbs } from '@/components/NeonOrbs';
import { JoinForm } from '@/features/remote/components/JoinForm';
import { NoticeBanner } from '@/features/remote/components/NoticeBanner';
import { ThemeToggle } from '@/features/remote/components/ThemeToggle';

interface HomeScreenProps {
  notice: string | null;
  // null until the pointer media query resolves; the card shows a placeholder meanwhile.
  isCoarsePointer: boolean | null;
  hostProfile: RegisteredUser | null;
  hostLoading: boolean;
  onJoin: (code: string) => void;
  joinError: string | null;
  isJoining: boolean;
}

// Landing page shown before a room is joined: go to your own room (host) or
// log in / register, plus the room-code form for guests.
export function HomeScreen({
  notice,
  isCoarsePointer,
  hostProfile,
  hostLoading,
  onJoin,
  joinError,
  isJoining,
}: HomeScreenProps) {
  const { t } = useTranslation();
  return (
    <main className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 py-10 overflow-hidden bg-bg text-fg">
      <NoticeBanner notice={notice} />
      <NeonOrbs />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted mb-3">
          {t('home.appHeading')}
        </p>
        <h1
          className="text-gradient-brand text-4xl sm:text-5xl font-bold mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('home.wordmark')}
        </h1>
        <p className="text-sm sm:text-base text-muted mb-8">{t('home.tagline')}</p>

        {isCoarsePointer === null || hostLoading ? (
          <div className="w-full h-[260px] rounded-3xl border border-border bg-surface/70 backdrop-blur-md shadow-glow" />
        ) : (
          <div className="w-full flex flex-col gap-4">
            {/* Host path — navigate directly; the guest-access API must
              not gate the owner from their own room. */}
            {hostProfile ? (
              <Link
                href={`/?room=${hostProfile.roomCode}`}
                className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] text-center block"
              >
                {t('auth.goToMyRoom')}
              </Link>
            ) : (
              <Link
                href="/register"
                className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] text-center block"
              >
                {t('auth.loginOrRegister')}
              </Link>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted uppercase tracking-widest">
                {t('auth.orDivider')}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Guest path — JoinForm provides its own card */}
            <JoinForm onJoin={onJoin} joinError={joinError} isJoining={isJoining} />
          </div>
        )}
      </div>
    </main>
  );
}
