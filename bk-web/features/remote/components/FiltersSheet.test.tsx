import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FilterChipId } from '@/lib/filters';
import { FiltersSheet } from './FiltersSheet';

function renderSheet(
  over: Partial<React.ComponentProps<typeof FiltersSheet>> = {},
) {
  const props: React.ComponentProps<typeof FiltersSheet> = {
    open: true,
    activeChips: new Set<FilterChipId>(),
    onApply: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  const utils = render(<FiltersSheet {...props} />);
  return { ...utils, props };
}

// The chip buttons expose their state via aria-pressed; "Bolero" is a stable,
// uniquely-labelled chip we can target.
function bolero() {
  return screen.getByRole('button', { name: 'Bolero' });
}

describe('FiltersSheet', () => {
  it('initialises the draft from activeChips when opened', () => {
    renderSheet({ activeChips: new Set<FilterChipId>(['bolero']) });
    expect(bolero()).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles a draft chip without committing until Apply', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderSheet({ onApply });

    expect(bolero()).toHaveAttribute('aria-pressed', 'false');
    await user.click(bolero());
    expect(bolero()).toHaveAttribute('aria-pressed', 'true');
    // No commit yet — onApply must not fire on a mere toggle.
    expect(onApply).not.toHaveBeenCalled();

    // With a chip selected the CTA switches from filtersViewAll to filtersApply.
    await user.click(screen.getByRole('button', { name: 'search.filtersApply' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect([...onApply.mock.calls[0][0]]).toEqual(['bolero']);
  });

  // Regression guard for the committedRef refactor (ref write moved from
  // render into an effect). The ref must still hold the LATEST committed
  // chips: if the parent updates activeChips while the sheet is closed, then
  // reopens it, the draft must initialise from the new committed value — not
  // a stale snapshot captured at first mount.
  it('reopens with the latest committed chips after a closed-state change', () => {
    const { rerender } = renderSheet({
      open: false,
      activeChips: new Set<FilterChipId>(),
    });
    // Parent commits a new filter while the sheet is closed.
    rerender(
      <FiltersSheet
        open={false}
        activeChips={new Set<FilterChipId>(['bolero'])}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    // Now open the sheet — the open-effect reads committedRef and seeds the
    // draft from the latest committed value.
    rerender(
      <FiltersSheet
        open
        activeChips={new Set<FilterChipId>(['bolero'])}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(bolero()).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not reset an in-progress draft when the parent re-renders while open', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSheet({
      open: true,
      activeChips: new Set<FilterChipId>(),
    });
    await user.click(bolero());
    expect(bolero()).toHaveAttribute('aria-pressed', 'true');

    // Parent re-renders (same open=true) with an unrelated committed change.
    // The open-effect deps are [open] so it must NOT re-run and clobber the
    // user's in-progress draft selection.
    rerender(
      <FiltersSheet
        open
        activeChips={new Set<FilterChipId>(['tone-nam'])}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(bolero()).toHaveAttribute('aria-pressed', 'true');
  });
});
