import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RemoteControls } from './RemoteControls';

const baseProps = {
  isPlaying: false,
  volume: 50,
  hasHistory: false,
  hasQueue: false,
  currentPlaying: null,
  onTogglePlayPause: () => {},
  onVolumeChange: () => {},
  onPrev: () => {},
  onNext: () => {},
};

describe('RemoteControls', () => {
  it('disables prev when no history and next when no queue', () => {
    render(<RemoteControls {...baseProps} />);
    expect(screen.getByRole('button', { name: 'controls.previousLabel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'controls.nextLabel' })).toBeDisabled();
  });

  it('enables prev/next when history/queue exist', () => {
    render(<RemoteControls {...baseProps} hasHistory hasQueue />);
    expect(screen.getByRole('button', { name: 'controls.previousLabel' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'controls.nextLabel' })).toBeEnabled();
  });

  it('exposes a Play label when paused and Pause label when playing', () => {
    const { rerender } = render(<RemoteControls {...baseProps} />);
    expect(screen.getByRole('button', { name: 'controls.playLabel' })).toBeInTheDocument();
    rerender(<RemoteControls {...baseProps} isPlaying />);
    expect(screen.getByRole('button', { name: 'controls.pauseLabel' })).toBeInTheDocument();
  });

  it('volume slider emits numeric values via onVolumeChange', async () => {
    const onVolumeChange = vi.fn();
    render(<RemoteControls {...baseProps} onVolumeChange={onVolumeChange} />);
    const slider = screen.getByRole('slider');
    await userEvent.setup().clear(slider).catch(() => {});
    // Direct change event keeps it deterministic across browsers.
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    // userEvent click on slider does not produce a value — fire the input event.
    fireSliderInput(slider as HTMLInputElement, 75);
    expect(onVolumeChange).toHaveBeenCalledWith(75);
  });

  it('renders the duration when currentPlaying has one', () => {
    render(
      <RemoteControls
        {...baseProps}
        currentPlaying={{
          id: 'x',
          title: 't',
          channel: 'c',
          thumbnail: '',
          duration: '3:45',
        }}
      />,
    );
    expect(screen.getByText('3:45')).toBeInTheDocument();
  });
});

function fireSliderInput(input: HTMLInputElement, value: number) {
  const proto = Object.getPrototypeOf(input) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(input, String(value));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
