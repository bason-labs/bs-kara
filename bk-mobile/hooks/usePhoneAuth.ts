import { useCallback, useRef, useState } from 'react';
import { signInWithPhoneNumber, type ConfirmationResult, type User } from 'firebase/auth';
import type { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
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
  recaptchaRef: React.RefObject<FirebaseRecaptchaVerifierModal | null>;
}

export function usePhoneAuth(): PhoneAuthState {
  const [step, setStep] = useState<PhoneAuthStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal | null>(null);

  const sendOtp = useCallback(async (e164Phone: string): Promise<boolean> => {
    setStep('sending');
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      confirmationRef.current = await signInWithPhoneNumber(auth, e164Phone, recaptchaRef.current as any);
      setStep('awaiting_otp');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep('error');
      return false;
    }
  }, []);

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
    confirmationRef.current = null;
    setStep('idle');
    setError(null);
  }, []);

  return { step, error, sendOtp, verifyOtp, reset, recaptchaRef };
}
