import { expect, test } from '@playwright/test';

// Admin routes require a valid __session cookie. Tests assert unauthenticated
// redirect behaviour — full auth flow requires live Firebase credentials.
test.describe('/admin/sessions — unauthenticated', () => {
  test('redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin/sessions');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 5_000 });
  });
});
