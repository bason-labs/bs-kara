'use client';

import { useState } from 'react';
import { suspendUser, unsuspendUser, type RegisteredUser } from '@/lib/registeredUsers';

interface UserListProps {
  users: RegisteredUser[];
  onRefresh: () => void;
}

export function UserList({ users, onRefresh }: UserListProps) {
  const [loadingPhone, setLoadingPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleSuspend(user: RegisteredUser) {
    setError(null);
    setLoadingPhone(user.normalizedPhone);
    try {
      if (user.suspended) {
        await unsuspendUser(user.normalizedPhone);
      } else {
        await suspendUser(user.normalizedPhone);
      }
      onRefresh();
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoadingPhone(null);
    }
  }

  if (users.length === 0) {
    return <p className="text-muted text-sm">Chưa có người dùng nào.</p>;
  }

  return (
    <div className="overflow-x-auto">
      {error && <p className="text-danger text-xs mb-2" role="alert">{error}</p>}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-muted text-xs uppercase tracking-wider">
            <th className="text-left py-2 pr-4">Số điện thoại</th>
            <th className="text-left py-2 pr-4">Mã phòng</th>
            <th className="text-left py-2 pr-4">Tên</th>
            <th className="text-left py-2 pr-4">Trạng thái</th>
            <th className="text-left py-2">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.normalizedPhone} className="border-t border-border">
              <td className="py-2 pr-4 font-mono">{user.normalizedPhone}</td>
              <td className="py-2 pr-4 font-mono font-bold">{user.roomCode}</td>
              <td className="py-2 pr-4 text-muted">{user.displayName ?? '—'}</td>
              <td className="py-2 pr-4">
                <span className={`px-2 py-0.5 rounded-full text-xs ${user.suspended ? 'bg-danger/20 text-danger' : 'bg-green-500/20 text-green-400'}`}>
                  {user.suspended ? 'Tạm ngưng' : 'Hoạt động'}
                </span>
              </td>
              <td className="py-2">
                <button
                  onClick={() => toggleSuspend(user)}
                  disabled={loadingPhone === user.normalizedPhone}
                  className="text-xs px-3 py-1 rounded-full border border-border hover:bg-surface-2 disabled:opacity-40 transition-colors"
                >
                  {user.suspended ? 'Kích hoạt' : 'Tạm ngưng'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
