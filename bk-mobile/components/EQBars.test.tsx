import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

import { EQBars } from './EQBars';

describe('EQBars', () => {
  it('renders 4 bars when reduce-motion is off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { getAllByTestId } = render(<EQBars />);
    await waitFor(() => expect(getAllByTestId('eq-bar')).toHaveLength(4));
  });

  it('renders static bars with testID eq-bars-static when reduce-motion is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { getByTestId } = render(<EQBars />);
    await waitFor(() => expect(getByTestId('eq-bars-static')).toBeTruthy());
  });
});
