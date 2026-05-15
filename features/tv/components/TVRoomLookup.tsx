'use client';

import { FormEvent, useState } from 'react';

interface TVRoomLookupProps {
  resolveRoomCode: (input: string) => Promise<string | null>;
  onActivate: (code: string) => Promise<void>;
}

export function TVRoomLookup({ resolveRoomCode, onActivate }: TVRoomLookupProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      const code = await resolveRoomCode(trimmed);
      if (!code) {
        setError('Không tìm thấy phòng hoặc phòng đang bị tạm ngưng.');
        return;
      }
      await onActivate(code);
    } catch {
      setError('Đã xảy ra lỗi, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center bg-bg text-fg px-6">
      <h1 className="text-gradient-brand text-5xl font-bold mb-2">KARA</h1>
      <p className="text-muted text-sm mb-10">Nhập số điện thoại hoặc mã phòng</p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="VD: 0912345678 hoặc 5678"
          className="w-full px-4 py-3 rounded-2xl border border-border bg-surface text-fg text-center text-lg tracking-widest placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
          autoFocus
          disabled={loading}
        />

        {error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Đang kiểm tra...' : 'Kích hoạt phòng'}
        </button>
      </form>
    </main>
  );
}
