'use client';

import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toE164VN } from '@/lib/subscriptions/phone';

interface PhoneStepProps {
  onSubmit: (e164Phone: string) => void;
  loading: boolean;
  error: string | null;
}

export function PhoneStep({ onSubmit, loading, error }: PhoneStepProps) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState('');

  const e164 = toE164VN(raw);
  const canSubmit = e164 !== null && !loading;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (e164) onSubmit(e164);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-xs uppercase tracking-[0.25em] text-muted">
          {t('auth.phoneLabel')}
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder={t('auth.phonePlaceholder')}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-3 rounded-2xl bg-surface border border-border text-fg text-lg tracking-widest placeholder:text-muted/50 focus:outline-none focus:border-glow focus:shadow-glow transition-all disabled:opacity-50"
        />
        {raw && e164 === null && (
          <p className="text-xs text-danger">{t('auth.errors.invalidPhone')}</p>
        )}
        {error && (
          <p className="text-xs text-danger">{t('auth.errors.sendFailed')}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {loading ? t('auth.sendingOtp') : t('auth.sendOtp')}
      </button>
    </form>
  );
}
