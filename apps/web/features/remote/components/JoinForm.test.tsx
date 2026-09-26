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

async function typeCode(code: string) {
  const inputs = screen.getAllByRole('textbox');
  for (const [i, digit] of [...code].entries()) await userEvent.type(inputs[i], digit);
}

describe('JoinForm', () => {
  it('disables join until 4 digits are typed, then calls onJoin with the code', async () => {
    const onJoin = vi.fn();
    render(<JoinForm onJoin={onJoin} joinError={null} isJoining={false} />);
    const btn = screen.getByRole('button', { name: 'home.joinButton' });
    expect(btn).toBeDisabled();

    await typeCode('1234');
    await userEvent.click(btn);

    expect(onJoin).toHaveBeenCalledWith('1234');
  });

  it('does not call onJoin while a join is already in flight', async () => {
    const onJoin = vi.fn();
    render(<JoinForm onJoin={onJoin} joinError={null} isJoining={true} />);

    await typeCode('1234');

    expect(screen.getByRole('button', { name: 'Đang kiểm tra…' })).toBeDisabled();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it.each([
    { joinError: 'notFound', message: 'home.invalidCode' },
    { joinError: 'suspended', message: 'Phòng này tạm thời không khả dụng.' },
    { joinError: 'error', message: 'Đã xảy ra lỗi, vui lòng thử lại.' },
  ] as const)('shows the $joinError error message', ({ joinError, message }) => {
    render(<JoinForm onJoin={vi.fn()} joinError={joinError} isJoining={false} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
