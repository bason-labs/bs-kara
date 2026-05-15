import { expect, test } from '@playwright/test';

test.describe('TV room lookup', () => {
  test('shows the lookup form immediately on /tv, not the waiting overlay', async ({
    page,
  }) => {
    await page.goto('/tv');
    // First confirm the page has rendered with the lookup form visible.
    await expect(
      page.getByText(/Nhập số điện thoại hoặc mã phòng/i),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByPlaceholder(/VD: 0912345678/i),
    ).toBeVisible({ timeout: 10_000 });
    // Now it is safe to assert the old waiting overlay is absent.
    await expect(page.getByText(/Nhấn vào bất kỳ đâu/i)).not.toBeVisible();
  });

  test('typing in the lookup input and clicking Kích hoạt attempts validation', async ({
    page,
  }) => {
    await page.goto('/tv');
    const input = page.getByPlaceholder(/VD: 0912345678/i);
    await input.fill('0000');
    const btn = page.getByRole('button', { name: /Kích hoạt phòng/i });
    await btn.click();
    // Without a live Firebase backend the lookup call will fail (network
    // error or empty response). The form should NOT navigate away — the
    // lookup form must still be visible.
    await expect(input).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Phone join form', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('does not show the old "Tham gia phòng đang mở" shortcut button', async ({
    page,
  }) => {
    await page.goto('/');
    // Ensure the page has rendered (OTP inputs are present).
    await expect(page.getByLabel(/Digit \d/).first()).toBeVisible({
      timeout: 10_000,
    });
    // The old shortcut button from the singleton active-room pointer must be gone.
    await expect(page.getByText(/Tham gia phòng đang mở/i)).not.toBeVisible();
  });

  test('shows plain OTP input and join button with QR tip', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel(/Digit \d/)).toHaveCount(4);
    await expect(page.getByText(/Mã phòng/i).first()).toBeVisible();
    await expect(page.getByText(/Hoặc quét mã QR/i)).toBeVisible();
  });
});
