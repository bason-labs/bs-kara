'use client';

import { FormEvent, useState } from 'react';
import { registerUser } from '@/lib/registeredUsers';

interface RegisterUserFormProps {
  onRegistered: () => void;
}

export function RegisterUserForm({ onRegistered }: RegisterUserFormProps) {
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const { roomCode } = await registerUser({
        phone,
        displayName: displayName.trim() || undefined,
      });
      setResult(`Đã tạo phòng: ${roomCode}`);
      setPhone('');
      setDisplayName('');
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 rounded-2xl border border-border bg-surface">
      <h2 className="font-semibold text-sm uppercase tracking-wider text-muted">Đăng ký người dùng mới</h2>
      <input
        type="text"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Số điện thoại (VD: 0912345678)"
        required
        className="px-3 py-2 rounded-xl border border-border bg-bg text-fg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Tên hiển thị (tuỳ chọn)"
        className="px-3 py-2 rounded-xl border border-border bg-bg text-fg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      {error && <p className="text-danger text-xs" role="alert">{error}</p>}
      {result && <p className="text-green-400 text-xs" role="status">{result}</p>}
      <button
        type="submit"
        disabled={loading || !phone.trim()}
        className="py-2.5 rounded-full bg-gradient-brand text-white text-sm font-semibold disabled:opacity-40"
      >
        {loading ? 'Đang xử lý...' : 'Đăng ký'}
      </button>
    </form>
  );
}
