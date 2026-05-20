'use client';

import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';
import { OTPInput } from './OTPInput';

interface JoinFormProps {
  onJoin: (code: string) => void;
  joinError: string | null;
  isJoining: boolean;
}

// Self-contained OTP join form. Owns inputCode locally; emits onJoin when the
// typed/completed code is within the valid length range and not already joining.
export function JoinForm({ onJoin, joinError, isJoining }: JoinFormProps) {
  const { t } = useTranslation();
  const [inputCode, setInputCode] = useState('');

  const canSubmit =
    inputCode.length >= 4 && inputCode.length <= 7 && !isJoining;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (canSubmit) onJoin(inputCode);
  }

  let errorMessage: string | null = null;
  if (joinError === 'room_not_found' || joinError === 'notFound') {
    errorMessage = t('home.invalidCode');
  } else if (joinError === 'suspended') {
    errorMessage = 'Phòng này tạm thời không khả dụng.';
  } else if (joinError === 'subscription_expired') {
    errorMessage = 'Phòng này không còn hoạt động.';
  } else if (joinError === 'guests_not_allowed') {
    errorMessage = 'Phòng chưa mở — hãy chờ chủ phòng bật chế độ cho khách tham gia.';
  } else if (joinError === 'error') {
    errorMessage = 'Đã xảy ra lỗi, vui lòng thử lại.';
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full flex flex-col items-center gap-6 rounded-3xl border border-border bg-surface/70 backdrop-blur-md p-6 sm:p-8 shadow-glow"
    >
      <label className="w-full text-left text-xs uppercase tracking-[0.25em] text-muted">
        {t('home.roomCodeLabel')}
      </label>

      <OTPInput
        value={inputCode}
        onChange={setInputCode}
        onComplete={(v) => { if (!isJoining) onJoin(v); }}
        ariaLabel={t('home.roomCodeLabel')}
      />

      {errorMessage && (
        <p
          className={`text-xs text-center ${
            joinError === 'guests_not_allowed' ? 'text-muted' : 'text-danger'
          }`}
        >
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isJoining ? 'Đang kiểm tra…' : t('home.joinButton')}
      </button>

      <p className="flex items-center gap-2 text-xs text-muted">
        <QrCode size={14} />
        {t('home.qrTip')}
      </p>
    </form>
  );
}
