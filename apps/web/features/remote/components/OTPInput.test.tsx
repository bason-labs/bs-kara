import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OTPInput } from './OTPInput';

// Wrapper that owns the controlled `value` so user input actually updates
// what's rendered, the same way the real parent (RemoteClient) does.
function Harness({
  initialValue = '',
  onChange,
  onComplete,
  disabled = false,
}: {
  initialValue?: string;
  onChange?: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <OTPInput
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      onComplete={onComplete}
      autoFocus={false}
      disabled={disabled}
    />
  );
}

describe('OTPInput', () => {
  it('renders four input boxes by default', () => {
    render(<Harness />);
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });

  it('rejects non-digit characters', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getAllByRole('textbox')[0], 'a');
    // 'a' gets stripped to '' which is the same as the initial value;
    // setDigitAt still fires onChange with '' on each non-digit keystroke.
    for (const call of onChange.mock.calls) {
      expect(call[0]).toBe('');
    }
  });

  it('typing a digit advances focus to the next box and forwards the joined value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    await user.type(inputs[0], '1');
    expect(onChange).toHaveBeenCalledWith('1');
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('completes after typing all 4 digits', () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<Harness onChange={onChange} onComplete={onComplete} />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.change(inputs[3], { target: { value: '4' } });
    expect(onChange).toHaveBeenLastCalledWith('1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('multi-character input distributes across boxes and completes', () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<Harness onChange={onChange} onComplete={onComplete} />);
    const first = screen.getAllByRole('textbox')[0];
    // Triggers the multi-char branch of handleChange (same logic the paste
    // handler uses).
    fireEvent.change(first, { target: { value: '5678' } });
    expect(onChange).toHaveBeenLastCalledWith('5678');
    expect(onComplete).toHaveBeenCalledWith('5678');
  });

  it('Backspace on a filled box clears that box', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue="12" onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    inputs[1].focus();
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith('1');
  });

  it('disabled inputs ignore user input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness disabled onChange={onChange} />);
    const first = screen.getAllByRole('textbox')[0];
    expect(first).toBeDisabled();
    await user.type(first, '9');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('arrow keys navigate without changing the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    inputs[1].focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(inputs[0]);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(inputs[1]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Escape clears all digits and refocuses the first box', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue="1234" onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    // Focus a box other than the first to prove focus returns to box 0.
    inputs[2].focus();
    await user.keyboard('{Escape}');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('Home key moves focus to the first box from any position', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    inputs[3].focus();
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('End key moves focus to the last box from any position', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    inputs[0].focus();
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(inputs[3]);
  });
});
