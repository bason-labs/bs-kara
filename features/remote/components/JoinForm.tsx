'use client';

import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';
import { OTPInput } from './OTPInput';

interface JoinFormProps {
  // Currently-claimed room (from the active-room pointer). null while we
  // haven't loaded yet; absent string when no room is active.
  activeRoom: string | null;
  // True once the active-room subscription has emitted at least once.
  // Lets the form distinguish "loading" from "no room".
  pointerLoaded: boolean;
  onJoin: (code: string) => void;
}

// Self-contained OTP join form. Owns inputCode locally; emits onJoin only
// when the typed/clicked code passes the active-room match check that the
// parent applies inside submitJoin.
export function JoinForm({ activeRoom, pointerLoaded, onJoin }: JoinFormProps) {
  const { t } = useTranslation();
  const [inputCode, setInputCode] = useState('');

  const codeMismatch =
    pointerLoaded && inputCode.length === 4 && inputCode !== activeRoom;
  const canSubmit =
    !!activeRoom && inputCode.length === 4 && inputCode === activeRoom;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onJoin(inputCode);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full flex flex-col items-center gap-6 rounded-3xl border border-border bg-surface/70 backdrop-blur-md p-6 sm:p-8 shadow-glow"
    >
      {activeRoom && (
        <button
          type="button"
          onClick={() => onJoin(activeRoom)}
          className="w-full py-3 rounded-full border border-border bg-bg/40 text-sm font-medium tracking-wide text-fg hover:bg-bg/60 transition-colors"
        >
          {t('home.joinActiveRoom', { code: activeRoom })}
        </button>
      )}

      <label className="w-full text-left text-xs uppercase tracking-[0.25em] text-muted">
        {t('home.roomCodeLabel')}
      </label>

      <OTPInput
        value={inputCode}
        onChange={setInputCode}
        onComplete={onJoin}
        ariaLabel={t('home.roomCodeLabel')}
        disabled={pointerLoaded && !activeRoom}
      />

      {pointerLoaded && !activeRoom ? (
        <p className="text-xs text-muted text-center leading-relaxed">
          {t('home.noActiveRoom')}
        </p>
      ) : codeMismatch ? (
        <p className="text-xs text-danger text-center">
          {t('home.invalidCode')}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {t('home.joinButton')}
      </button>

      <p className="flex items-center gap-2 text-xs text-muted">
        <QrCode size={14} />
        {t('home.qrTip')}
      </p>
    </form>
  );
}
