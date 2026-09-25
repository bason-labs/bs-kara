import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

const baseProps = {
  title: 'Delete?',
  message: 'Are you sure?',
  confirmLabel: 'Yes',
  cancelLabel: 'No',
};

describe('ConfirmDialog', () => {
  it('renders the title, message, and both buttons when open', () => {
    render(<ConfirmDialog open {...baseProps} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'No' }).length).toBeGreaterThan(0);
  });

  it('clicking Confirm fires onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open {...baseProps} onConfirm={onConfirm} onCancel={() => {}} />,
    );
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Escape fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open {...baseProps} onConfirm={() => {}} onCancel={onCancel} />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open {...baseProps} onConfirm={() => {}} onCancel={onCancel} />,
    );
    // The backdrop is rendered as a button with aria-label = cancelLabel.
    const backdrop = screen.getAllByRole('button', { name: 'No' })[0];
    await user.click(backdrop);
    expect(onCancel).toHaveBeenCalled();
  });

  it('marks the dialog inert when closed', () => {
    render(
      <ConfirmDialog open={false} {...baseProps} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('inert');
  });
});
