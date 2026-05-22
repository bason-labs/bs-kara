import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { getApp } from 'firebase/app';
import { auth } from '@bs-kara/shared';
import { usePhoneAuth } from '@/hooks/usePhoneAuth';
import { registerUser, lookupUserByPhone, ensureHostUid } from '@/lib/registeredUsers';
import { toE164VN } from '@/lib/phone';

type UiStep = 'phone' | 'otp' | 'name';
const RESEND_SECONDS = 60;
const OTP_LENGTH = 6;

// ─── Phone Step ──────────────────────────────────────────────────────────────

function PhoneStep({
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (e164: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState('');
  const e164 = toE164VN(raw);
  const canSubmit = e164 !== null && !loading;

  return (
    <View className="w-full gap-5">
      <View className="gap-1.5">
        <Text className="text-xs uppercase tracking-[4px] text-[#7aa8a8]">
          {t('auth.phoneLabel')}
        </Text>
        <TextInput
          value={raw}
          onChangeText={setRaw}
          keyboardType="phone-pad"
          placeholder={t('auth.phonePlaceholder')}
          placeholderTextColor="#3a5f5f"
          editable={!loading}
          returnKeyType="done"
          onSubmitEditing={() => { if (e164) onSubmit(e164); }}
          className="w-full px-4 py-3.5 rounded-2xl bg-[#152a2a] border border-[#1f3a3a] text-[#e0ffff] text-lg tracking-widest"
        />
        {raw.length > 0 && e164 === null && (
          <Text className="text-xs text-[#ff5f6d]">{t('auth.errors.invalidPhone')}</Text>
        )}
        {error && (
          <Text className="text-xs text-[#ff5f6d]">{t('auth.errors.sendFailed')}</Text>
        )}
      </View>

      <TouchableOpacity
        onPress={() => { if (e164) onSubmit(e164); }}
        disabled={!canSubmit}
        activeOpacity={0.8}
        className="w-full rounded-full overflow-hidden"
        style={{ opacity: canSubmit ? 1 : 0.4 }}
      >
        <LinearGradient
          colors={['#008b8b', '#006d6f', '#0d98ba']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="py-4 items-center"
        >
          <Text className="text-[#e0ffff] font-semibold text-base tracking-wide">
            {loading ? t('auth.sendingOtp') : t('auth.sendOtp')}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── OTP Step ─────────────────────────────────────────────────────────────────

function OtpStep({
  phone,
  onSubmit,
  onResend,
  loading,
  error,
}: {
  phone: string;
  onSubmit: (code: string) => void;
  onResend: () => void;
  loading: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  function handleCodeChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (digits.length === OTP_LENGTH && !loading) onSubmit(digits);
  }

  function handleResend() {
    setCode('');
    setCountdown(RESEND_SECONDS);
    onResend();
  }

  const masked = phone.replace(/(\+84)(\d{2})(\d{3})(\d{2})(\d{2})/, '0$2 $3 **$5');

  return (
    <View className="w-full gap-5 items-center">
      <Text className="text-sm text-[#7aa8a8] text-center">
        {t('auth.otpHint', { phone: masked })}
      </Text>

      {/* 6-box OTP */}
      <Pressable
        onPress={() => inputRef.current?.focus()}
        className="flex-row gap-2 justify-center"
      >
        {Array.from({ length: OTP_LENGTH }).map((_, i) => {
          const char = code[i] ?? '';
          const isActive = !loading && (
            i === code.length || (i === OTP_LENGTH - 1 && code.length === OTP_LENGTH)
          );
          return (
            <View
              key={i}
              className="w-11 h-14 rounded-xl bg-[#152a2a] items-center justify-center"
              style={{
                borderWidth: 2,
                borderColor: isActive ? '#40e0d0' : char ? '#2a5050' : '#1f3a3a',
              }}
            >
              <Text className="text-[#e0ffff] text-xl font-bold">{char}</Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={handleCodeChange}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoFocus
        editable={!loading}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />

      {error && (
        <Text className="text-xs text-[#ff5f6d] text-center">{t('auth.errors.otpFailed')}</Text>
      )}

      <TouchableOpacity
        onPress={handleResend}
        disabled={loading || countdown > 0}
        activeOpacity={0.7}
        style={{ opacity: loading || countdown > 0 ? 0.4 : 1 }}
      >
        <Text className="text-sm text-[#7aa8a8]">
          {countdown > 0
            ? t('auth.resendIn', { seconds: countdown })
            : t('auth.resend')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => { if (code.length === OTP_LENGTH) onSubmit(code); }}
        disabled={code.length < OTP_LENGTH || loading}
        activeOpacity={0.8}
        className="w-full rounded-full overflow-hidden"
        style={{ opacity: code.length < OTP_LENGTH || loading ? 0.4 : 1 }}
      >
        <LinearGradient
          colors={['#008b8b', '#006d6f', '#0d98ba']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="py-4 items-center"
        >
          <Text className="text-[#e0ffff] font-semibold text-base tracking-wide">
            {loading ? t('auth.verifying') : t('auth.verify')}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Name Step ────────────────────────────────────────────────────────────────

function NameStep({
  onSubmit,
  loading,
}: {
  onSubmit: (displayName: string | undefined) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  return (
    <View className="w-full gap-6">
      <View className="gap-2">
        <Text className="text-xs uppercase tracking-[4px] text-[#7aa8a8]">
          {t('auth.displayNameLabel')}
        </Text>
        <Text className="text-sm text-[#7aa8a8]">{t('auth.displayNameHint')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('auth.displayNamePlaceholder')}
          placeholderTextColor="#3a5f5f"
          editable={!loading}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => onSubmit(name.trim() || undefined)}
          className="w-full px-4 py-3.5 rounded-2xl bg-[#152a2a] border border-[#1f3a3a] text-[#e0ffff] text-base"
        />
      </View>

      <View className="gap-3">
        <TouchableOpacity
          onPress={() => onSubmit(name.trim() || undefined)}
          disabled={loading}
          activeOpacity={0.8}
          className="w-full rounded-full overflow-hidden"
          style={{ opacity: loading ? 0.4 : 1 }}
        >
          <LinearGradient
            colors={['#008b8b', '#006d6f', '#0d98ba']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="py-4 items-center"
          >
            <Text className="text-[#e0ffff] font-semibold text-base tracking-wide">
              {loading ? '…' : t('auth.continue')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSubmit(undefined)}
          disabled={loading}
          activeOpacity={0.7}
          style={{ opacity: loading ? 0.4 : 1 }}
          className="py-2.5 items-center"
        >
          <Text className="text-sm text-[#7aa8a8]">{t('auth.skip')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const STEPS: UiStep[] = ['phone', 'otp', 'name'];

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { step: authStep, error, sendOtp, verifyOtp, reset, recaptchaRef } = usePhoneAuth();
  const [uiStep, setUiStep] = useState<UiStep>('phone');
  const [e164Phone, setE164Phone] = useState('');
  const [saving, setSaving] = useState(false);

  const app = getApp();

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
      router.replace({ pathname: '/(room)/search', params: { roomCode: existing.roomCode } });
      return;
    }
    setUiStep('name');
  }, [verifyOtp, e164Phone, router]);

  const handleSaveName = useCallback(async (displayName: string | undefined) => {
    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      const { roomCode } = await registerUser({ phone: e164Phone, displayName, uid });
      router.replace({ pathname: '/(room)/search', params: { roomCode } });
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
  const stepIndex = STEPS.indexOf(uiStep);

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={app.options}
        attemptInvisibleVerification
      />

      {/* Back button — only after phone step */}
      {uiStep !== 'phone' && (
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          className="flex-row items-center gap-2 px-4 pt-4 pb-2"
        >
          <ArrowLeft size={20} color="#7aa8a8" />
          <Text className="text-[#7aa8a8] text-sm">{t('auth.back')}</Text>
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 items-center justify-center px-6 py-10 gap-8">
            {/* Header */}
            <View className="items-center gap-1.5">
              <Text className="text-4xl font-bold text-[#40e0d0]">{t('auth.title')}</Text>
              <Text className="text-sm text-[#7aa8a8] text-center">{t('auth.subtitle')}</Text>
            </View>

            {/* Step dots */}
            <View className="flex-row items-center gap-2">
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={{
                    height: 6,
                    borderRadius: 3,
                    width: i === stepIndex ? 32 : 8,
                    backgroundColor: i === stepIndex ? '#40e0d0' : i < stepIndex ? '#008b8b66' : '#1f3a3a',
                  }}
                />
              ))}
            </View>

            {/* Card */}
            <View
              className="w-full bg-[#0e1c1c] border border-[#1f3a3a] rounded-3xl p-7"
              style={{ shadowColor: '#008b8b', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 }}
            >
              {isLoading && uiStep !== 'otp' && uiStep !== 'name' && (
                <View className="absolute inset-0 items-center justify-center z-10 rounded-3xl bg-[#0e1c1c]/80">
                  <ActivityIndicator color="#40e0d0" />
                </View>
              )}

              {uiStep === 'phone' && (
                <PhoneStep onSubmit={handleSendOtp} loading={isLoading} error={sendError} />
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
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
