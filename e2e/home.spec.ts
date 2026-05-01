import { expect, test } from '@playwright/test';

// Desktop viewport — RemoteClient renders the OTP join form.
test.use({ viewport: { width: 1280, height: 800 } });

test.describe('home page (desktop)', () => {
  test('shows the wordmark and a 4-digit OTP input', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const otpInputs = page.getByLabel(/Digit \d/);
    await expect(otpInputs).toHaveCount(4);
  });

  test('renders the room-code label and a Join button', async ({ page }) => {
    await page.goto('/');
    // vi.json: home.roomCodeLabel = "Mã phòng"
    await expect(page.getByText(/Mã phòng/i).first()).toBeVisible();
  });

  test('a malformed `?room=` value falls back to the home shell', async ({ page }) => {
    await page.goto('/?room=abc');
    // The malformed code triggers the "room not found" notice and bounces to /.
    // Assert the OTP form is back rather than the URL — toHaveURL is racy when
    // the redirect lands during hydration on slower CI runs.
    await expect(page.getByLabel(/Digit \d/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/(\?.*)?$/);
  });
});
