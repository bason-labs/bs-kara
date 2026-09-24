import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RemoteControls } from './RemoteControls';

const baseProps = {
  isPlaying: false,
  hasHistory: false,
  hasQueue: false,
  currentPlaying: null,
  onTogglePlayPause: () => {},
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

  it('does not render a volume slider', () => {
    render(<RemoteControls {...baseProps} />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
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
