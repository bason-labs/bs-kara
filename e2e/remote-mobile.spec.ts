import { devices, expect, test } from '@playwright/test';

// iPhone 13 device = mobile viewport + touch + coarse pointer. This is the
// reason to keep this file: it exercises the phone-home gate under a real
// mobile viewport, not just the desktop viewport that multi-room.spec uses.
//
// Mobile auto-join was removed in the auth/host-registration refactor: a
// coarse-pointer device no longer auto-attaches to the active room or shows
// the "Đang mở phòng" (home.startingRoom) spinner. Mobile now gets the SAME
// gated OTP/JoinForm home screen as desktop.
test.use({ ...devices['iPhone 13'] });

test.describe('home page (mobile)', () => {
  test('renders the OTP/JoinForm home gate on coarse-pointer devices', async ({
    page,
  }) => {
    await page.goto('/');
    // Mobile no longer skips the OTP form — the 4-digit room-code inputs
    // render exactly as they do on desktop (no mobile auto-join).
    await expect(page.getByLabel(/Digit \d/).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByLabel(/Digit \d/)).toHaveCount(4);
    // The join button is the gated action — proves this is the join form, not
    // the removed starting-room spinner.
    await expect(
      page.getByRole('button', { name: /Vào phòng/i }),
    ).toBeVisible();
  });

  test('shows the room-code label and QR tip on the mobile home gate', async ({
    page,
  }) => {
    await page.goto('/');
    // Ensure the form has rendered before asserting its copy.
    await expect(page.getByLabel(/Digit \d/).first()).toBeVisible({
      timeout: 10_000,
    });
    // The QR-scan affordance (home.qrTip) replaces the removed auto-join
    // spinner copy — phones are told to read the code off the TV.
    await expect(page.getByText(/Mã phòng/i).first()).toBeVisible();
    await expect(page.getByText(/Hoặc quét mã QR/i)).toBeVisible();
  });
});
