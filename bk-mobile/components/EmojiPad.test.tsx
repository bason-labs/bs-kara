import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmojiPad } from './EmojiPad';

jest.mock('@bs-kara/shared', () => ({
  REACTIONS: ['💖', '🔥', '🎉', '👏', '🥳'],
}));

describe('EmojiPad', () => {
  it('renders all 5 reaction buttons', () => {
    const onSend = jest.fn();
    const { getAllByRole } = render(<EmojiPad onSend={onSend} />);
    expect(getAllByRole('button').length).toBe(5);
  });

  it('calls onSend with the tapped emoji', () => {
    const onSend = jest.fn();
    const { getByText } = render(<EmojiPad onSend={onSend} />);
    fireEvent.press(getByText('💖'));
    expect(onSend).toHaveBeenCalledWith('💖');
  });
});
