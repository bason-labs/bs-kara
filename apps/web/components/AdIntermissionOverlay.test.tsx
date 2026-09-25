import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdIntermissionOverlay } from './AdIntermissionOverlay';

// i18n t() is mocked to echo the key so assertions don't depend on copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('AdIntermissionOverlay', () => {
  it('renders the intermission title', () => {
    render(<AdIntermissionOverlay variant="tv" />);
    expect(screen.getByText('adMask.title')).toBeInTheDocument();
  });

  it('shows the next song title when provided', () => {
    render(<AdIntermissionOverlay variant="tv" nextSongTitle="Hotel California" />);
    expect(screen.getByText('Hotel California')).toBeInTheDocument();
  });

  it('omits the next-up row when no next song is given', () => {
    render(<AdIntermissionOverlay variant="phone" nextSongTitle={null} />);
    expect(screen.queryByText('adMask.nextUp')).not.toBeInTheDocument();
  });
});
