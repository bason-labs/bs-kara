import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { MCAnnouncementOverlay } from './MCAnnouncementOverlay';

describe('MCAnnouncementOverlay', () => {
  it('renders the title and announcement pill', () => {
    render(<MCAnnouncementOverlay variant="phone" title="My Song" />);
    expect(screen.getByText('My Song')).toBeInTheDocument();
    expect(screen.getByText('aiMc.announcing')).toBeInTheDocument();
  });

  // The FullscreenPlayer's own top bar is hidden while MC is speaking, so
  // the close affordance has to live inside the overlay. Without it, the
  // user would be locked into fullscreen for the duration of the MC.
  it('does not render a close button when onClose is omitted', () => {
    render(<MCAnnouncementOverlay variant="phone" title="My Song" />);
    expect(
      screen.queryByRole('button', { name: 'player.closeFullscreen' }),
    ).not.toBeInTheDocument();
  });

  it('renders a close button and fires onClose when provided', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MCAnnouncementOverlay variant="phone" title="My Song" onClose={onClose} />,
    );
    await user.click(
      screen.getByRole('button', { name: 'player.closeFullscreen' }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
