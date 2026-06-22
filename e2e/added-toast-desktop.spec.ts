import { expect, test } from '@playwright/test';

// Desktop viewport is the default for all projects in playwright.config.ts
// (Desktop Chrome/Firefox/Safari). These tests verify that the AddedToast
// container carries the lg: positioning classes that pin it to the top-right
// corner on desktop — as opposed to the bottom-full-width mobile layout.
//
// The toast itself is rendered (hidden) in the room shell even without a live
// Firebase backend, so navigating to /?room=1234 is enough to mount it.

test.describe('AddedToast — desktop layout', () => {
  test('toast container is mounted and has lg:top-4 / lg:right-4 classes on desktop', async ({
    page,
  }) => {
    // /?room=1234 causes useRoomGate to set roomCode, which renders the room
    // shell (including AddedToast) rather than the join-form home screen.
    await page.goto('/?room=1234');
    // Wait for the room shell to render (header appears before Firebase data).
    await expect(page.locator('[aria-live="polite"][aria-atomic="true"]')).toBeAttached({
      timeout: 15_000,
    });

    const toastContainer = page.locator('[aria-live="polite"][aria-atomic="true"]');
    const className = await toastContainer.getAttribute('class');
    expect(className).toContain('lg:top-4');
    expect(className).toContain('lg:right-4');
    expect(className).toContain('lg:left-auto');
    // Mobile bottom position must still be present (used on narrow viewports).
    expect(className).toContain('bottom-[84px]');
  });

  test('toast container does NOT appear in the join-form home screen (no roomCode)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByLabel(/Digit \d/).first()).toBeVisible({ timeout: 10_000 });
    // AddedToast is only rendered inside the room shell, not the join form.
    await expect(
      page.locator('[aria-live="polite"][aria-atomic="true"]'),
    ).not.toBeAttached();
  });
});
