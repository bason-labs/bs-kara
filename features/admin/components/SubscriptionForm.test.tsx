import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { pushMock, refreshMock, submitMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  submitMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));
vi.mock('../hooks/useCreateSubscription', () => ({
  useCreateSubscription: () => ({
    submit: submitMock,
    submitting: false,
    error: null,
    fieldErrors: {},
  }),
}));

import { SubscriptionForm } from './SubscriptionForm';

describe('SubscriptionForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    submitMock.mockReset();
    submitMock.mockResolvedValue({ ok: true, id: 'new-id' });
  });

  it('paymentRef is hidden when type=trial and visible when type=paid', async () => {
    render(<SubscriptionForm />);
    expect(screen.queryByLabelText(/Mã thanh toán/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Trả phí' }));
    expect(screen.getByLabelText(/Mã thanh toán/)).toBeInTheDocument();
  });

  it('switching from paid back to trial removes paymentRef from the DOM', async () => {
    render(<SubscriptionForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Trả phí' }));
    const ref = screen.getByLabelText(/Mã thanh toán/) as HTMLInputElement;
    await userEvent.type(ref, 'PAY-LEAK');

    await userEvent.click(screen.getByRole('button', { name: 'Dùng thử' }));
    expect(screen.queryByLabelText(/Mã thanh toán/)).toBeNull();
  });

  it('shows the "Lưu trữ: +84..." hint when a valid 0XXX number is entered and blurred', async () => {
    render(<SubscriptionForm />);
    const phone = screen.getByLabelText(/Số điện thoại/);
    await userEvent.type(phone, '0901234567');
    fireEvent.blur(phone);
    expect(await screen.findByText('Lưu trữ: +84901234567')).toBeInTheDocument();
  });

  it('does NOT show the normalised hint for an invalid number', async () => {
    render(<SubscriptionForm />);
    const phone = screen.getByLabelText(/Số điện thoại/);
    await userEvent.type(phone, '+84901234567');
    fireEvent.blur(phone);
    expect(screen.queryByText(/Lưu trữ:/)).toBeNull();
  });

  it('submit with invalid phone shows inline error and does NOT call submit()', async () => {
    render(<SubscriptionForm />);
    const phone = screen.getByLabelText(/Số điện thoại/);
    await userEvent.type(phone, '+84901234567'); // wrong format
    await userEvent.click(
      screen.getByRole('button', { name: 'Tạo gói đăng ký' }),
    );
    expect(submitMock).not.toHaveBeenCalled();
    expect(
      screen.getByText('Số điện thoại không hợp lệ. Định dạng: 0XXXXXXXXX'),
    ).toBeInTheDocument();
  });

  it('submit with paid but empty paymentRef shows inline error', async () => {
    render(<SubscriptionForm />);
    await userEvent.type(
      screen.getByLabelText(/Số điện thoại/),
      '0901234567',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Trả phí' }));
    // durationDays cleared on switch to paid; fill it in.
    const dur = screen.getByLabelText(/Số ngày/);
    await userEvent.type(dur, '30');
    await userEvent.click(
      screen.getByRole('button', { name: 'Tạo gói đăng ký' }),
    );
    expect(submitMock).not.toHaveBeenCalled();
    expect(
      screen.getByText('Mã thanh toán là bắt buộc với gói trả phí.'),
    ).toBeInTheDocument();
  });

  it('submit with durationDays = 0 shows inline error', async () => {
    const { container } = render(<SubscriptionForm />);
    await userEvent.type(
      screen.getByLabelText(/Số điện thoại/),
      '0901234567',
    );
    const dur = screen.getByLabelText(/Số ngày/) as HTMLInputElement;
    // fireEvent.change bypasses HTML5 min/step constraints that
    // userEvent.type respects — we deliberately want to exercise the JS
    // validation path here, not the browser's number-input gating.
    fireEvent.change(dur, { target: { value: '0' } });
    const form = container.querySelector('form');
    if (!form) throw new Error('form not rendered');
    fireEvent.submit(form);
    expect(submitMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByText('Số ngày phải từ 1 đến 365.'),
      ).toBeInTheDocument(),
    );
  });

  it('successful submit calls router.push("/admin/subscriptions")', async () => {
    submitMock.mockResolvedValueOnce({ ok: true, id: 'new-id' });
    render(<SubscriptionForm />);
    await userEvent.type(
      screen.getByLabelText(/Số điện thoại/),
      '0901234567',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Tạo gói đăng ký' }),
    );
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith('/admin/subscriptions');
  });
});

describe('SubscriptionForm — server-state surfacing', () => {
  it('renders submitting state on the submit button', () => {
    vi.resetModules();
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: pushMock, refresh: refreshMock }),
    }));
    vi.doMock('../hooks/useCreateSubscription', () => ({
      useCreateSubscription: () => ({
        submit: submitMock,
        submitting: true,
        error: null,
        fieldErrors: {},
      }),
    }));
    return import('./SubscriptionForm').then(({ SubscriptionForm: Submitting }) => {
      render(<Submitting />);
      const btn = screen.getByRole('button', { name: 'Đang tạo...' });
      expect(btn).toBeDisabled();
    });
  });

  it('renders top-level error (e.g. 409 message) above the form', () => {
    vi.resetModules();
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: pushMock, refresh: refreshMock }),
    }));
    vi.doMock('../hooks/useCreateSubscription', () => ({
      useCreateSubscription: () => ({
        submit: submitMock,
        submitting: false,
        error: 'Số điện thoại này đã sử dụng dùng thử trước đó.',
        fieldErrors: {},
      }),
    }));
    return import('./SubscriptionForm').then(({ SubscriptionForm: WithErr }) => {
      render(<WithErr />);
      expect(
        screen.getByText('Số điện thoại này đã sử dụng dùng thử trước đó.'),
      ).toBeInTheDocument();
    });
  });
});
