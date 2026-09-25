'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OTPInput } from '@/features/remote/components/OTPInput';

interface OtpStepProps {
  phone: string;
  onSubmit: (code: string) => void;
  onResend: () => void;
  loading: boolean;
  error: string | null;
}

const RESEND_SECONDS = 60;

export function OtpStep({ phone, onSubmit, onResend, loading, error }: OtpStepProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  function handleComplete(val: string) {
    if (!loading) onSubmit(val);
  }

  function handleResend() {
    setCode('');
    setCountdown(RESEND_SECONDS);
    onResend();
  }

  const masked = phone.replace(/(\+84)(\d{2})(\d{3})(\d{2})(\d{2})/, '0$2 $3 **$5');

  return (
    <div className="w-full flex flex-col gap-5 items-center">
      <p className="text-sm text-muted text-center">
        {t('auth.otpHint', { phone: masked })}
      </p>

      <OTPInput
        length={6}
        value={code}
        onChange={setCode}
        onComplete={handleComplete}
        disabled={loading}
        ariaLabel={t('auth.otpLabel')}
        compact
      />

      {error && (
        <p className="text-xs text-danger text-center">{t('auth.errors.otpFailed')}</p>
      )}

      <button
        type="button"
        disabled={loading || countdown > 0}
        onClick={handleResend}
        className="text-sm text-muted hover:text-fg transition-colors disabled:opacity-40"
      >
        {countdown > 0
          ? t('auth.resendIn', { seconds: countdown })
          : t('auth.resend')}
      </button>

      <button
        type="button"
        disabled={code.length < 6 || loading}
        onClick={() => onSubmit(code)}
        className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {loading ? t('auth.verifying') : t('auth.verify')}
      </button>
    </div>
  );
}
