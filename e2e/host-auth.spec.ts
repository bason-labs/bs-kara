import { test, expect } from '@playwright/test';

// Firebase test phone: add +84 900 000 001 → code 123456 in Firebase console
// before running E2E tests.
const TEST_PHONE = '0900000001';
const TEST_OTP = '123456';

// @live — requires a live Firebase test phone + a pre-existing room; excluded from CI.
test.describe('Host registration flow @live', () => {
  test('new host registers, gets room, sees all settings sections', async ({ page }) => {
    await page.goto('/register');

    // Step 1: phone
    await page.getByLabel('auth.phoneLabel').fill(TEST_PHONE);
    await page.getByRole('button', { name: 'auth.sendOtp' }).click();

    // Step 2: OTP
    const otpInputs = page.locator('input[aria-label^="Digit"]');
    await expect(otpInputs).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await otpInputs.nth(i).fill(TEST_OTP[i]);
    }

    // Step 3: name (skip)
    await page.getByRole('button', { name: 'auth.skip' }).click();

    // Should land in room
    await expect(page).toHaveURL(/\/\?room=\d+/);

    // Open settings — host sees all sections
    await page.getByRole('button', { name: 'settings.openLabel' }).click();
    await expect(page.getByText('settings.sections.queue')).toBeVisible();
    await expect(page.getByText('settings.sections.autoRandom')).toBeVisible();
    await expect(page.getByText('settings.sections.aiMc')).toBeVisible();
  });

  test('guest joining a room sees only theme + room code in settings', async ({ page }) => {
    // Assume room code 1234 exists (created by the host test above)
    await page.goto('/');
    const codeInputs = page.locator('input[aria-label^="Digit"]');
    for (let i = 0; i < 4; i++) {
      await codeInputs.nth(i).fill('1234'[i]);
    }
    await page.getByRole('button', { name: 'home.joinButton' }).click();
    await expect(page).toHaveURL(/\/\?room=1234/);

    await page.getByRole('button', { name: 'settings.openLabel' }).click();
    await expect(page.getByText('settings.sections.appearance')).toBeVisible();
    await expect(page.getByText('settings.sections.room')).toBeVisible();
    await expect(page.getByText('settings.sections.queue')).not.toBeVisible();
  });
});
