'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-glow/40 bg-surface-2 p-8 shadow-glow text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface text-glow">
          <Compass size={28} aria-hidden="true" />
        </div>
        <p className="font-display text-5xl font-bold text-gradient-brand leading-none">
          404
        </p>
        <h1 className="mt-3 text-lg font-semibold text-fg">
          {t('errors.notFound.title')}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t('errors.notFound.message')}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block w-full py-3 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98]"
        >
          {t('errors.notFound.cta')}
        </Link>
      </div>
    </main>
  );
}
