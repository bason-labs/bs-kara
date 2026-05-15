/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/registeredUsers', () => ({
  registerUser: vi.fn(),
}));

import { registerUser } from '@/lib/registeredUsers';
import { RegisterUserForm } from './RegisterUserForm';

const registerMock = registerUser as ReturnType<typeof vi.fn>;

let resolveCurrentMock: ((v: { roomCode: string; normalizedPhone: string }) => void) | null = null;
let rejectCurrentMock: ((e: Error) => void) | null = null;

beforeEach(() => {
  resolveCurrentMock = null;
  rejectCurrentMock = null;
  registerMock.mockReset();
});

afterEach(() => {
  // Resolve any pending mock promise to prevent cleanup timeout
  resolveCurrentMock?.({ roomCode: '0000', normalizedPhone: '84000000000' });
  cleanup();
});

describe('RegisterUserForm', () => {
  it('submit button is disabled when phone is empty', () => {
    render(<RegisterUserForm onRegistered={() => {}} />);
    const button = screen.getByRole('button', { name: 'Đăng ký' });
    expect(button).toBeDisabled();
  });

  it('calls registerUser with phone and optional displayName on submit', async () => {
    registerMock.mockResolvedValue({ roomCode: '5678', normalizedPhone: '84912345678' });
    const user = userEvent.setup();
    render(<RegisterUserForm onRegistered={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Số điện thoại/), '0912345678');
    await user.type(screen.getByPlaceholderText(/Tên hiển thị/), 'Nguyễn Văn A');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        phone: '0912345678',
        displayName: 'Nguyễn Văn A',
      });
    });
  });

  it('shows success message with room code after registration', async () => {
    registerMock.mockResolvedValue({ roomCode: '5678', normalizedPhone: '84912345678' });
    const user = userEvent.setup();
    render(<RegisterUserForm onRegistered={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Số điện thoại/), '0912345678');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Đã tạo phòng: 5678');
    });
  });

  it('shows error message when registerUser throws', async () => {
    // Use a controlled deferred promise: reject it AFTER handleSubmit has
    // already started `await registerUser(...)` so the catch block is the
    // FIRST handler — no unhandledRejection fires from Node's perspective.
    registerMock.mockImplementation(
      () =>
        new Promise<never>((_, rej) => {
          rejectCurrentMock = rej;
        }),
    );
    const user = userEvent.setup();
    render(<RegisterUserForm onRegistered={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Số điện thoại/), '0912345678');
    // Click fires handleSubmit which reaches `await registerUser()` and suspends
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));
    // Wait one tick so handleSubmit suspends at the await before we reject
    await Promise.resolve();
    // Reject now — handleSubmit's catch block is already the sole handler
    rejectCurrentMock!(new Error('Phone number already registered'));
    rejectCurrentMock = null;

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Phone number already registered'),
    );
  });

  it('calls onRegistered callback after success', async () => {
    registerMock.mockResolvedValue({ roomCode: '5678', normalizedPhone: '84912345678' });
    const onRegistered = vi.fn();
    const user = userEvent.setup();
    render(<RegisterUserForm onRegistered={onRegistered} />);

    await user.type(screen.getByPlaceholderText(/Số điện thoại/), '0912345678');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await waitFor(() => {
      expect(onRegistered).toHaveBeenCalledTimes(1);
    });
  });
});
