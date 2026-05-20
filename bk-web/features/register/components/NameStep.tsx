'use client';

import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface NameStepProps {
  onSubmit: (displayName: string | undefined) => void;
  loading: boolean;
}

export function NameStep({ onSubmit, loading }: NameStepProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(name.trim() || undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="display-name" className="text-xs uppercase tracking-[0.25em] text-muted">
            {t('auth.displayNameLabel')}
          </label>
          <p className="mt-1.5 text-sm text-muted/70 leading-relaxed">
            {t('auth.displayNameHint')}
          </p>
        </div>
        <input
          id="display-name"
          type="text"
          autoComplete="name"
          placeholder={t('auth.displayNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-3.5 rounded-2xl bg-surface border border-border text-fg placeholder:text-muted/40 focus:outline-none focus:border-glow focus:shadow-glow transition-all disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {loading ? '…' : t('auth.continue')}
        </button>

        <button
          type="button"
          onClick={() => onSubmit(undefined)}
          disabled={loading}
          className="w-full py-2.5 text-sm text-muted hover:text-fg transition-colors"
        >
          {t('auth.skip')}
        </button>
      </div>
    </form>
  );
}
