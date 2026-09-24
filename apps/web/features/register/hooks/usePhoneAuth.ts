'use client';

import { useCallback, useRef, useState } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { auth } from '@bs-kara/shared';

export type PhoneAuthStep =
  | 'idle'
  | 'sending'
  | 'awaiting_otp'
  | 'verifying'
  | 'complete'
  | 'error';

export interface PhoneAuthState {
  step: PhoneAuthStep;
  error: string | null;
  sendOtp: (e164Phone: string) => Promise<boolean>;
  verifyOtp: (code: string) => Promise<User | null>;
  reset: () => void;
}

export function usePhoneAuth(): PhoneAuthState {
  const [step, setStep] = useState<PhoneAuthStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const getRecaptcha = useCallback((): RecaptchaVerifier => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        { size: 'invisible' },
      );
    }
    return recaptchaRef.current;
  }, []);

  const sendOtp = useCallback(async (e164Phone: string): Promise<boolean> => {
    setStep('sending');
    setError(null);
    try {
      const verifier = getRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(auth, e164Phone, verifier);
      setStep('awaiting_otp');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep('error');
      return false;
    }
  }, [getRecaptcha]);

  const verifyOtp = useCallback(async (code: string): Promise<User | null> => {
    if (!confirmationRef.current) return null;
    setStep('verifying');
    setError(null);
    try {
      const credential = await confirmationRef.current.confirm(code);
      setStep('complete');
      return credential.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
    confirmationRef.current = null;
    setStep('idle');
    setError(null);
  }, []);

  return { step, error, sendOtp, verifyOtp, reset };
}
