import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OTPInput } from './OTPInput';

describe('OTPInput', () => {
  it('renders a text input', () => {
    const { getByTestId } = render(
      <OTPInput value="" onChange={jest.fn()} onComplete={jest.fn()} />
    );
    expect(getByTestId('otp-input')).toBeTruthy();
  });

  it('calls onChange when user types', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <OTPInput value="" onChange={onChange} onComplete={jest.fn()} />
    );
    fireEvent.changeText(getByTestId('otp-input'), '1234');
    expect(onChange).toHaveBeenCalledWith('1234');
  });

  it('calls onComplete when 4+ digits entered', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <OTPInput value="" onChange={jest.fn()} onComplete={onComplete} />
    );
    fireEvent.changeText(getByTestId('otp-input'), '12345');
    expect(onComplete).toHaveBeenCalledWith('12345');
  });

  it('does not call onComplete for fewer than 4 digits', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <OTPInput value="" onChange={jest.fn()} onComplete={onComplete} />
    );
    fireEvent.changeText(getByTestId('otp-input'), '123');
    expect(onComplete).not.toHaveBeenCalled();
  });
});
