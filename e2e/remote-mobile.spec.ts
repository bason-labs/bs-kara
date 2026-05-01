import { devices, expect, test } from '@playwright/test';

// Mobile viewport: RemoteClient skips the OTP form and shows the
// "starting room" spinner while it tries to claim/attach to a room.
test.use({ ...devices['iPhone 13'] });

test.describe('home page (mobile)', () => {
  test('skips the OTP form on coarse-pointer devices', async ({ page }) => {
    await page.goto('/');
    // Wait briefly to ensure the post-mount coarse-pointer detection has run.
    await page.waitForTimeout(500);
    // The OTP digits are not rendered for mobile.
    await expect(page.getByLabel(/Digit \d/)).toHaveCount(0);
  });

  test('shows the starting-room spinner copy while attaching', async ({ page }) => {
    await page.goto('/');
    // vi.json: home.startingRoom = "Đang mở phòng karaoke…"
    await expect(page.getByText(/Đang mở phòng/i)).toBeVisible({ timeout: 10_000 });
  });
});
