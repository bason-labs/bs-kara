import { render } from '@testing-library/react-native';
import { AdIntermissionOverlay } from './AdIntermissionOverlay';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('AdIntermissionOverlay', () => {
  it('renders the intermission title', () => {
    const { getByText } = render(<AdIntermissionOverlay />);
    expect(getByText('adMask.title')).not.toBeNull();
  });
  it('shows the next song title when provided', () => {
    const { getByText } = render(<AdIntermissionOverlay nextSongTitle="Hotel California" />);
    expect(getByText('Hotel California')).not.toBeNull();
  });
  it('omits the next-up row when no next song is given', () => {
    const { queryByText } = render(<AdIntermissionOverlay nextSongTitle={null} />);
    expect(queryByText('adMask.nextUp')).toBeNull();
  });
});
