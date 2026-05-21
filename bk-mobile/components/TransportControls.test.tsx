import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TransportControls } from './TransportControls';

describe('TransportControls', () => {
  it('calls onPlayPause when play button pressed', () => {
    const onPlayPause = jest.fn();
    const { getByTestId } = render(
      <TransportControls
        isPlaying={false}
        onPlayPause={onPlayPause}
        onPrev={jest.fn()}
        onNext={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('play-pause-button'));
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });

  it('calls onPrev when previous button pressed', () => {
    const onPrev = jest.fn();
    const { getByTestId } = render(
      <TransportControls
        isPlaying={true}
        onPlayPause={jest.fn()}
        onPrev={onPrev}
        onNext={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('prev-button'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('calls onNext when next button pressed', () => {
    const onNext = jest.fn();
    const { getByTestId } = render(
      <TransportControls
        isPlaying={true}
        onPlayPause={jest.fn()}
        onPrev={jest.fn()}
        onNext={onNext}
      />
    );
    fireEvent.press(getByTestId('next-button'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
