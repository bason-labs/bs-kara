import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const {
  useSubscriptionDetailMock,
  useCancelSubscriptionMock,
  pushMock,
  refreshMock,
} = vi.hoisted(() => ({
  useSubscriptionDetailMock: vi.fn(),
  useCancelSubscriptionMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));
vi.mock('../hooks/useSubscriptionDetail', () => ({
  useSubscriptionDetail: useSubscriptionDetailMock,
}));
vi.mock('../hooks/useCancelSubscription', () => ({
  useCancelSubscription: useCancelSubscriptionMock,
}));

import { SubscriptionDetail } from './SubscriptionDetail';

const DAY_MS = 86_400_000;
const NOW = 1_700_000_000_000;

const baseRecord = {
  id: 'sub-1',
  userPhone: '+84901234567',
  userId: null,
  type: 'trial' as const,
  status: 'active' as const,
  durationDays: 14,
  startDate: NOW,
  endDate: NOW + 14 * DAY_MS,
  source: 'manual_admin' as const,
  paymentRef: null,
  createdBy: 'admin-uid',
  createdAt: NOW,
  updatedAt: NOW,
};

const activeData = {
  record: baseRecord,
  derivedStatus: 'active' as const,
  daysLeft: 14,
};
const expiredData = {
  record: { ...baseRecord, endDate: NOW - DAY_MS },
  derivedStatus: 'expired' as const,
  daysLeft: 0,
};
const cancelledData = {
  record: { ...baseRecord, status: 'cancelled' as const },
  derivedStatus: 'cancelled' as const,
  daysLeft: 0,
};

function defaultCancelHook(overrides: Record<string, unknown> = {}) {
  return {
    cancel: vi.fn().mockResolvedValue({ ok: true }),
    cancelling: false,
    error: null,
    ...overrides,
  };
}

beforeEach(() => {
  useSubscriptionDetailMock.mockReset();
  useCancelSubscriptionMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
});

describe('SubscriptionDetail', () => {
  it('renders loading state', () => {
    useSubscriptionDetailMock.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });
    useCancelSubscriptionMock.mockReturnValue(defaultCancelHook());
    render(<SubscriptionDetail id="sub-1" />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
  });

  it('renders error state with back link', () => {
    useSubscriptionDetailMock.mockReturnValue({
      data: null,
      loading: false,
      error: 'Không tìm thấy gói đăng ký.',
      refetch: vi.fn(),
    });
    useCancelSubscriptionMock.mockReturnValue(defaultCancelHook());
    render(<SubscriptionDetail id="missing" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy');
    expect(
      screen.getByRole('link', { name: /Quay lại danh sách/ }),
    ).toBeInTheDocument();
  });

  it('renders all fields for an active record', () => {
    useSubscriptionDetailMock.mockReturnValue({
      data: activeData,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useCancelSubscriptionMock.mockReturnValue(defaultCancelHook());
    render(<SubscriptionDetail id="sub-1" />);

    expect(screen.getByText(/Chi tiết gói đăng ký/)).toBeInTheDocument();
    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument();
    // "14 ngày" appears in both Còn lại (status section) and Số ngày
    // (record fields). Both should render — assert two occurrences.
    expect(screen.getAllByText('14 ngày').length).toBe(2);
    expect(screen.getAllByText('+84901234567').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Dùng thử')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument(); // stored status
    expect(screen.getByText('Thủ công')).toBeInTheDocument();
    expect(screen.getByText('admin-uid')).toBeInTheDocument();
  });

  it('cancel button visible for active records', () => {
    useSubscriptionDetailMock.mockReturnValue({
      data: activeData,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useCancelSubscriptionMock.mockReturnValue(defaultCancelHook());
    render(<SubscriptionDetail id="sub-1" />);
    expect(
      screen.getByRole('button', { name: /Huỷ gói đăng ký/ }),
    ).toBeInTheDocument();
  });

  it('cancel button HIDDEN for expired records', () => {
    useSubscriptionDetailMock.mockReturnValue({
      data: expiredData,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useCancelSubscriptionMock.mockReturnValue(defaultCancelHook());
    render(<SubscriptionDetail id="sub-1" />);
    expect(screen.getByText('Hết hạn')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Huỷ gói đăng ký/ }),
    ).toBeNull();
  });

  it('cancel button HIDDEN for cancelled records', () => {
    useSubscriptionDetailMock.mockReturnValue({
      data: cancelledData,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useCancelSubscriptionMock.mockReturnValue(defaultCancelHook());
    render(<SubscriptionDetail id="sub-1" />);
    expect(screen.getByText('Đã huỷ')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Huỷ gói đăng ký/ }),
    ).toBeNull();
  });

  it('declining the confirm does NOT call cancel()', async () => {
    const refetch = vi.fn();
    const cancelFn = vi.fn();
    useSubscriptionDetailMock.mockReturnValue({
      data: activeData,
      loading: false,
      error: null,
      refetch,
    });
    useCancelSubscriptionMock.mockReturnValue(
      defaultCancelHook({ cancel: cancelFn }),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<SubscriptionDetail id="sub-1" />);
    await userEvent.click(
      screen.getByRole('button', { name: /Huỷ gói đăng ký/ }),
    );
    expect(confirmSpy).toHaveBeenCalled();
    expect(cancelFn).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('confirming the cancel triggers cancel() and refetch on success', async () => {
    const refetch = vi.fn();
    const cancelFn = vi.fn().mockResolvedValue({ ok: true });
    useSubscriptionDetailMock.mockReturnValue({
      data: activeData,
      loading: false,
      error: null,
      refetch,
    });
    useCancelSubscriptionMock.mockReturnValue(
      defaultCancelHook({ cancel: cancelFn }),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<SubscriptionDetail id="sub-1" />);
    await userEvent.click(
      screen.getByRole('button', { name: /Huỷ gói đăng ký/ }),
    );
    await waitFor(() => expect(cancelFn).toHaveBeenCalledWith('sub-1'));
    expect(refetch).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows the cancel error near the button on failure', async () => {
    const cancelFn = vi.fn().mockResolvedValue({
      ok: false,
      error: 'already_cancelled',
      message: 'Gói đăng ký này đã được huỷ trước đó.',
    });
    useSubscriptionDetailMock.mockReturnValue({
      data: activeData,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useCancelSubscriptionMock.mockReturnValue(
      defaultCancelHook({ cancel: cancelFn }),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<SubscriptionDetail id="sub-1" />);
    await userEvent.click(
      screen.getByRole('button', { name: /Huỷ gói đăng ký/ }),
    );
    await waitFor(() =>
      expect(screen.getByText(/đã được huỷ/)).toBeInTheDocument(),
    );
    confirmSpy.mockRestore();
  });
});
