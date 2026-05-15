'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAllUsers, type RegisteredUser } from '@/lib/registeredUsers';
import { RegisterUserForm } from '@/features/admin/components/RegisterUserForm';
import { UserList } from '@/features/admin/components/UserList';
import { ActiveRoomsList } from '@/features/admin/components/ActiveRoomsList';

export default function RoomsPage() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllUsers();
      setUsers(all.sort((a, b) => b.createdAt - a.createdAt));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount; setState called inside async callback, not synchronously in the effect body
    void loadUsers();
  }, [loadUsers]);

  return (
    <div className="px-6 py-8 space-y-8">
      <div>
        <h1 className="text-lg font-bold text-fg">Quản lý phòng</h1>
        <p className="mt-1 text-xs text-muted">Đăng ký người dùng và quản lý phòng karaoke.</p>
      </div>

      <RegisterUserForm onRegistered={loadUsers} />

      <section className="space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted">Phòng đang hoạt động</h2>
        <ActiveRoomsList users={users} onRefresh={loadUsers} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted">
          Tất cả người dùng {!loading && `(${users.length})`}
        </h2>
        {loading ? (
          <p className="text-muted text-sm">Đang tải...</p>
        ) : (
          <UserList users={users} onRefresh={loadUsers} />
        )}
      </section>
    </div>
  );
}
