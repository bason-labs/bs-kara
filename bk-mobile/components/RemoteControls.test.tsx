import React from 'react';
import { render } from '@testing-library/react-native';

import { RemoteControls } from './RemoteControls';

const base = {
  isPlaying: false,
  hasHistory: true,
  hasQueue: true,
  onPlayPause: jest.fn(),
  onPrev: jest.fn(),
  onNext: jest.fn(),
};

describe('RemoteControls', () => {
  it('renders prev button with reduced opacity when hasHistory is false', () => {
    const { getByTestId } = render(<RemoteControls {...base} hasHistory={false} />);
    const style = getByTestId('prev-button').props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.opacity).toBe(0.3);
  });

  it('renders next button with reduced opacity when hasQueue is false', () => {
    const { getByTestId } = render(<RemoteControls {...base} hasQueue={false} />);
    const style = getByTestId('next-button').props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.opacity).toBe(0.3);
  });

  it('renders prev button at full opacity when hasHistory is true', () => {
    const { getByTestId } = render(<RemoteControls {...base} hasHistory={true} />);
    const style = getByTestId('prev-button').props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    // StyleSheet resolves to opacity 1 (full) — not the 0.3 disabled value
    expect(flat.opacity).toBe(1);
  });
});
