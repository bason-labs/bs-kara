'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminSignIn, type AdminSignInError } from '@/features/admin/lib/adminClient';

function errorMessage(err: AdminSignInError): string {
  switch (err) {
    case 'invalid_credentials':
      return 'Email hoặc mật khẩu không đúng.';
    case 'not_allowlisted':
      return 'Tài khoản này không có quyền truy cập quản trị.';
    case 'network_error':
      return 'Lỗi kết nối. Vui lòng thử lại.';
    default:
      return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  }
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const result = await adminSignIn(email.trim(), password);
    if (result.ok) {
      router.replace('/admin/subscriptions');
      router.refresh();
      return;
    }
    setError(errorMessage(result.error));
    setSubmitting(false);
  }

  const canSubmit =
    !submitting && email.trim().length > 0 && password.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg text-fg">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-5 rounded-3xl border border-border bg-surface/70 backdrop-blur-md p-6 sm:p-8 shadow-glow"
      >
        <header className="text-center">
          <h1 className="text-xl font-semibold tracking-wide">
            Đăng nhập quản trị
          </h1>
          <p className="mt-1 text-xs text-muted">BS Kara</p>
        </header>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg/40 text-fg outline-none focus:border-fg/40"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Mật khẩu
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg/40 text-fg outline-none focus:border-fg/40"
          />
        </label>

        {error && (
          <p className="text-xs text-danger text-center" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-3 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
