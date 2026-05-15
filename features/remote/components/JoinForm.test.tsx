/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { JoinForm } from './JoinForm';

describe('JoinForm', () => {
  it('renders the OTP input and join button with no error shown', () => {
    render(<JoinForm onJoin={vi.fn()} joinError={null} isJoining={false} />);
    // OTP group should be present
    expect(screen.getByRole('group', { name: 'home.roomCodeLabel' })).toBeInTheDocument();
    // Join button present
    expect(screen.getByRole('button', { name: 'home.joinButton' })).toBeInTheDocument();
    // No error messages
    expect(screen.queryByText('home.invalidCode')).not.toBeInTheDocument();
    expect(screen.queryByText('Phòng này tạm thời không khả dụng.')).not.toBeInTheDocument();
    expect(screen.queryByText('Đã xảy ra lỗi, vui lòng thử lại.')).not.toBeInTheDocument();
    // QR tip is present (it's always rendered)
    expect(screen.getByText('home.qrTip')).toBeInTheDocument();
  });

  it('renders the join button as disabled when input is empty', () => {
    render(<JoinForm onJoin={vi.fn()} joinError={null} isJoining={false} />);
    expect(screen.getByRole('button', { name: 'home.joinButton' })).toBeDisabled();
  });

  it('shows the notFound error message when joinError is notFound', () => {
    render(<JoinForm onJoin={vi.fn()} joinError="notFound" isJoining={false} />);
    expect(screen.getByText('home.invalidCode')).toBeInTheDocument();
  });

  it('shows the suspended error message when joinError is suspended', () => {
    render(<JoinForm onJoin={vi.fn()} joinError="suspended" isJoining={false} />);
    expect(screen.getByText('Phòng này tạm thời không khả dụng.')).toBeInTheDocument();
  });

  it('shows the generic error message when joinError is error', () => {
    render(<JoinForm onJoin={vi.fn()} joinError="error" isJoining={false} />);
    expect(screen.getByText('Đã xảy ra lỗi, vui lòng thử lại.')).toBeInTheDocument();
  });

  it('shows loading text when isJoining is true', async () => {
    const user = userEvent.setup();
    render(<JoinForm onJoin={vi.fn()} joinError={null} isJoining={true} />);
    expect(screen.getByRole('button', { name: 'Đang kiểm tra…' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'home.joinButton' })).not.toBeInTheDocument();
    // Button should be disabled during loading (isJoining prevents canSubmit)
    const btn = screen.getByRole('button', { name: 'Đang kiểm tra…' });
    // Type digits to check canSubmit is blocked by isJoining
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], '1');
    await user.type(inputs[1], '2');
    await user.type(inputs[2], '3');
    await user.type(inputs[3], '4');
    expect(btn).toBeDisabled();
  });

  it('does NOT render a join active room shortcut button', () => {
    render(<JoinForm onJoin={vi.fn()} joinError={null} isJoining={false} />);
    // The old shortcut had text containing 'joinActiveRoom'
    expect(screen.queryByText(/joinActiveRoom/)).not.toBeInTheDocument();
    // There should be exactly one button: the submit button
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
