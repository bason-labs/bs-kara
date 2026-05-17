// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@/lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  RecaptchaVerifier: vi.fn(function (this: unknown) {
    return { render: vi.fn().mockResolvedValue(0), clear: vi.fn() };
  }),
  signInWithPhoneNumber: vi.fn(),
}));

import * as firebaseAuth from 'firebase/auth';
import { renderHook, act } from '@testing-library/react';
import { usePhoneAuth } from './usePhoneAuth';

const RecaptchaVerifierMock = firebaseAuth.RecaptchaVerifier as unknown as Mock;
const signInWithPhoneNumberMock = firebaseAuth.signInWithPhoneNumber as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="recaptcha-container"></div>';
  RecaptchaVerifierMock.mockImplementation(function (this: unknown) {
    return { render: vi.fn().mockResolvedValue(0), clear: vi.fn() };
  });
});

describe('usePhoneAuth', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => usePhoneAuth());
    expect(result.current.step).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('transitions to awaiting_otp after sendOtp succeeds', async () => {
    const confirmMock = vi.fn();
    signInWithPhoneNumberMock.mockResolvedValueOnce({ confirm: confirmMock });
    const { result } = renderHook(() => usePhoneAuth());

    await act(async () => {
      await result.current.sendOtp('+84912345678');
    });

    expect(result.current.step).toBe('awaiting_otp');
    expect(result.current.error).toBeNull();
  });

  it('transitions to error when sendOtp fails', async () => {
    signInWithPhoneNumberMock.mockRejectedValueOnce(new Error('quota'));
    const { result } = renderHook(() => usePhoneAuth());

    await act(async () => {
      await result.current.sendOtp('+84912345678');
    });

    expect(result.current.step).toBe('error');
    expect(result.current.error).toBe('quota');
  });

  it('transitions to complete after verifyOtp succeeds', async () => {
    const fakeUser = { uid: 'u1', phoneNumber: '+84912345678' };
    const confirmMock = vi.fn().mockResolvedValueOnce({ user: fakeUser });
    signInWithPhoneNumberMock.mockResolvedValueOnce({ confirm: confirmMock });
    const { result } = renderHook(() => usePhoneAuth());

    await act(async () => { await result.current.sendOtp('+84912345678'); });
    await act(async () => { await result.current.verifyOtp('123456'); });

    expect(result.current.step).toBe('complete');
  });

  it('transitions to error when verifyOtp fails', async () => {
    const confirmMock = vi.fn().mockRejectedValueOnce(new Error('wrong-code'));
    signInWithPhoneNumberMock.mockResolvedValueOnce({ confirm: confirmMock });
    const { result } = renderHook(() => usePhoneAuth());

    await act(async () => { await result.current.sendOtp('+84912345678'); });
    await act(async () => { await result.current.verifyOtp('999999'); });

    expect(result.current.step).toBe('error');
    expect(result.current.error).toBe('wrong-code');
  });

  it('reset brings state back to idle', async () => {
    const confirmMock = vi.fn();
    signInWithPhoneNumberMock.mockResolvedValueOnce({ confirm: confirmMock });
    const { result } = renderHook(() => usePhoneAuth());
    await act(async () => { await result.current.sendOtp('+84912345678'); });

    act(() => { result.current.reset(); });

    expect(result.current.step).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
