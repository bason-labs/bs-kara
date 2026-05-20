'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { NeonOrbs } from '@/features/remote/components/NeonOrbs';
import { auth } from '@/lib/firebase';
import { usePhoneAuth } from './hooks/usePhoneAuth';
import { PhoneStep } from './components/PhoneStep';
import { OtpStep } from './components/OtpStep';
import { NameStep } from './components/NameStep';
import { registerUser, lookupUserByPhone, ensureHostUid } from '@/lib/registeredUsers';

type Step = 'phone' | 'otp' | 'name';

export function RegisterClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const { step: authStep, error, sendOtp, verifyOtp, reset } = usePhoneAuth();
  const [uiStep, setUiStep] = useState<Step>('phone');
  const [e164Phone, setE164Phone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSendOtp = useCallback(async (phone: string) => {
    setE164Phone(phone);
    const ok = await sendOtp(phone);
    if (ok) setUiStep('otp');
  }, [sendOtp]);

  const handleVerifyOtp = useCallback(async (code: string) => {
    const user = await verifyOtp(code);
    if (!user) return;
    const existing = await lookupUserByPhone(e164Phone);
    if (existing) {
      await ensureHostUid(existing.roomCode, user.uid);
      router.push(`/?room=${existing.roomCode}`);
      return;
    }
    setUiStep('name');
  }, [verifyOtp, e164Phone, router]);

  const handleSaveName = useCallback(async (displayName: string | undefined) => {
    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      const { roomCode } = await registerUser({ phone: e164Phone, displayName, uid });
      router.push(`/?room=${roomCode}`);
    } catch {
      setSaving(false);
    }
  }, [e164Phone, router]);

  const handleBack = useCallback(() => {
    reset();
    setUiStep('phone');
  }, [reset]);

  const isLoading = authStep === 'sending' || authStep === 'verifying' || saving;
  const sendError = authStep === 'error' && uiStep === 'phone' ? error : null;
  const otpError = authStep === 'error' && uiStep === 'otp' ? error : null;

  const steps: Step[] = ['phone', 'otp', 'name'];
  const stepIndex = steps.indexOf(uiStep);

  return (
    <main className="relative min-h-[100dvh] w-full flex flex-col overflow-hidden bg-bg text-fg">
      <NeonOrbs />

      {/* Back button — absolute top-left, visible only after phone step */}
      {uiStep !== 'phone' && (
        <button
          type="button"
          onClick={handleBack}
          className="absolute top-5 left-5 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface/80 border border-border text-sm text-muted hover:text-fg hover:bg-surface transition-colors backdrop-blur-sm"
        >
          <ChevronLeft size={15} />
          {t('auth.back')}
        </button>
      )}

      {/* Page content — centered, with generous vertical padding */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-sm flex flex-col items-center gap-8">

          {/* Header */}
          <div className="text-center space-y-1.5">
            <h1
              className="text-gradient-brand text-4xl font-bold"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('auth.title')}
            </h1>
            <p className="text-sm text-muted">{t('auth.subtitle')}</p>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex
                    ? 'w-8 bg-gradient-brand'
                    : i < stepIndex
                      ? 'w-2 bg-brand/50'
                      : 'w-2 bg-border'
                }`}
              />
            ))}
          </div>

          {/* Card */}
          <div className="w-full rounded-3xl border border-border bg-surface/80 backdrop-blur-md p-7 shadow-glow">
            {uiStep === 'phone' && (
              <PhoneStep
                onSubmit={handleSendOtp}
                loading={isLoading}
                error={sendError}
              />
            )}
            {uiStep === 'otp' && (
              <OtpStep
                phone={e164Phone}
                onSubmit={handleVerifyOtp}
                onResend={() => sendOtp(e164Phone)}
                loading={isLoading}
                error={otpError}
              />
            )}
            {uiStep === 'name' && (
              <NameStep onSubmit={handleSaveName} loading={saving} />
            )}
          </div>

        </div>
      </div>

      {/* Invisible reCAPTCHA — outside card so badge anchors to viewport corner */}
      <div id="recaptcha-container" className="absolute bottom-0 left-0" />
    </main>
  );
}
