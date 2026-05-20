/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayNowButton } from './PlayNowButton';

describe('PlayNowButton', () => {
  it('renders nothing when the row is currently playing', () => {
    const onClick = vi.fn();
    const { container } = render(
      <PlayNowButton videoId="abc" currentPlayingId="abc" onClick={onClick} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an action button and fires onClick when not the current track', async () => {
    const onClick = vi.fn();
    render(
      <PlayNowButton videoId="abc" currentPlayingId="other" onClick={onClick} />,
    );
    const btn = screen.getByRole('button', { name: 'playNow.aria' });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
