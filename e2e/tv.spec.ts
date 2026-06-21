import { expect, test } from '@playwright/test';

test.describe('/tv display', () => {
  test('shows lookup form with phone/code input and activate button', async ({ page }) => {
    await page.goto('/tv');
    // TVRoomLookup renders a descriptive paragraph, a text input, and an activate button.
    // The paragraph is the hint; the input has a different placeholder.
    await expect(
      page.getByText(/Nhập số điện thoại hoặc mã phòng/i),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByPlaceholder(/VD: 0912345678/i),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: /Kích hoạt phòng/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('upper-cases typed input so lower-case codes render as upper-case', async ({ page }) => {
    await page.goto('/tv');
    const input = page.getByPlaceholder(/VD: 0912345678/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill('abc1');
    await expect(input).toHaveValue('ABC1');
  });
});
