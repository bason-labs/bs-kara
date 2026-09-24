'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { WifiOff, RefreshCw } from 'lucide-react';
import { logError } from '@/lib/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: ErrorProps) {
  const { t } = useTranslation();

  useEffect(() => {
    logError('route-error', error);
  }, [error]);

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-glow/40 bg-surface-2 p-8 shadow-glow text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface text-glow">
          <WifiOff size={28} aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-fg">
          {t('errors.loadFailed.title')}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t('errors.loadFailed.message')}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98]"
          >
            <RefreshCw size={16} aria-hidden="true" />
            {t('errors.loadFailed.retry')}
          </button>
          <Link
            href="/"
            className="inline-block w-full py-2.5 rounded-full border border-border text-fg font-medium hover:bg-surface transition-colors"
          >
            {t('errors.loadFailed.home')}
          </Link>
        </div>
      </div>
    </main>
  );
}
