/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/registeredUsers', () => ({
  suspendUser: vi.fn().mockResolvedValue(undefined),
  unsuspendUser: vi.fn().mockResolvedValue(undefined),
}));

import { suspendUser, unsuspendUser } from '@/lib/registeredUsers';
import { UserList } from './UserList';
import type { RegisteredUser } from '@/lib/registeredUsers';

const suspendMock = suspendUser as ReturnType<typeof vi.fn>;
const unsuspendMock = unsuspendUser as ReturnType<typeof vi.fn>;

beforeEach(() => {
  suspendMock.mockReset().mockResolvedValue(undefined);
  unsuspendMock.mockReset().mockResolvedValue(undefined);
});

function makeUser(overrides: Partial<RegisteredUser> = {}): RegisteredUser {
  return {
    normalizedPhone: '84912345678',
    roomCode: '5678',
    suspended: false,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('UserList', () => {
  it('shows empty message when users array is empty', () => {
    render(<UserList users={[]} onRefresh={() => {}} />);
    expect(screen.getByText('Chưa có người dùng nào.')).toBeInTheDocument();
  });

  it('renders a row for each user with phone, roomCode, and status badge', () => {
    const users = [
      makeUser({ normalizedPhone: '84911111111', roomCode: '1111', suspended: false }),
      makeUser({ normalizedPhone: '84922222222', roomCode: '2222', suspended: true }),
    ];
    render(<UserList users={users} onRefresh={() => {}} />);

    expect(screen.getByText('84911111111')).toBeInTheDocument();
    expect(screen.getByText('1111')).toBeInTheDocument();
    // Active user: status badge shows "Hoạt động", action button shows "Tạm ngưng"
    expect(screen.getByText('Hoạt động')).toBeInTheDocument();

    expect(screen.getByText('84922222222')).toBeInTheDocument();
    expect(screen.getByText('2222')).toBeInTheDocument();
    // Suspended user: status badge + action button both say "Tạm ngưng" and "Kích hoạt"
    // Use getAllByText to handle the duplicate "Tạm ngưng" text (badge + one action button)
    expect(screen.getAllByText('Tạm ngưng').length).toBe(2);
    expect(screen.getByRole('button', { name: 'Kích hoạt' })).toBeInTheDocument();
  });

  it('clicking "Tạm ngưng" on an active user calls suspendUser then onRefresh', async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(<UserList users={[makeUser({ suspended: false })]} onRefresh={onRefresh} />);

    await user.click(screen.getByRole('button', { name: 'Tạm ngưng' }));

    await waitFor(() => {
      expect(suspendMock).toHaveBeenCalledWith('84912345678');
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('clicking "Kích hoạt" on a suspended user calls unsuspendUser then onRefresh', async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(<UserList users={[makeUser({ suspended: true })]} onRefresh={onRefresh} />);

    await user.click(screen.getByRole('button', { name: 'Kích hoạt' }));

    await waitFor(() => {
      expect(unsuspendMock).toHaveBeenCalledWith('84912345678');
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('does not silently swallow errors when suspendUser rejects', async () => {
    suspendMock.mockRejectedValue(new Error('network error'));
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(<UserList users={[makeUser({ suspended: false })]} onRefresh={onRefresh} />);

    await user.click(screen.getByRole('button', { name: 'Tạm ngưng' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Đã xảy ra lỗi. Vui lòng thử lại.');
    });
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
