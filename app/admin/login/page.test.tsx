/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/admin/lib/adminClient', () => ({
  adminSignIn: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

import { adminSignIn } from '@/features/admin/lib/adminClient';
import { useRouter } from 'next/navigation';
import AdminLoginPage from './page';

const signInMock = adminSignIn as ReturnType<typeof vi.fn>;
const useRouterMock = useRouter as ReturnType<typeof vi.fn>;

describe('AdminLoginPage', () => {
  const replaceMock = vi.fn();
  const refreshMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({ replace: replaceMock, refresh: refreshMock });
  });

  it('renders email input, password input, and submit button', () => {
    render(<AdminLoginPage />);
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/mật khẩu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đăng nhập/i })).toBeInTheDocument();
  });

  it('shows loading state while submitting', async () => {
    const user = userEvent.setup();
    // Make adminSignIn hang so we can observe the loading state
    signInMock.mockReturnValue(new Promise(() => {}));

    render(<AdminLoginPage />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'admin@test.com');
    await user.type(screen.getByLabelText(/mật khẩu/i), 'password123');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /đang đăng nhập/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /đang đăng nhập/i })).toBeDisabled();
  });

  it('shows error message when adminSignIn returns invalid_credentials', async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue({ ok: false, error: 'invalid_credentials' });

    render(<AdminLoginPage />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'wrong@test.com');
    await user.type(screen.getByLabelText(/mật khẩu/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/email hoặc mật khẩu không đúng/i),
      ).toBeInTheDocument();
    });
  });

  it('shows error when sign-in returns not_allowlisted (email not admin)', async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue({ ok: false, error: 'not_allowlisted' });

    render(<AdminLoginPage />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'other@test.com');
    await user.type(screen.getByLabelText(/mật khẩu/i), 'password123');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/không có quyền truy cập quản trị/i),
      ).toBeInTheDocument();
    });
  });

  it('redirects to /admin/subscriptions on successful sign-in', async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue({ ok: true });

    render(<AdminLoginPage />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'admin@test.com');
    await user.type(screen.getByLabelText(/mật khẩu/i), 'correctpass');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/admin/subscriptions');
    });
  });
});
