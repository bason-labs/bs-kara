import React from 'react';
import { render } from '@testing-library/react-native';
import { SearchSkeleton } from './SearchSkeleton';

describe('SearchSkeleton', () => {
  it('renders exactly 8 skeleton rows', () => {
    const { getAllByTestId } = render(<SearchSkeleton />);
    expect(getAllByTestId('skeleton-row')).toHaveLength(8);
  });
});
