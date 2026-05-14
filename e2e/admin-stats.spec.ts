import { expect, test } from '@playwright/test';

// Admin routes require a valid __session cookie. These tests assert the page
// structure when unauthenticated (redirect to login) — full auth flow is an
// integration concern beyond Phase 2 scope.
test.describe('/admin/stats — unauthenticated', () => {
  test('redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin/stats');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 5_000 });
  });
});

test.describe('/admin/login page', () => {
  test('shows the login form', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Mật khẩu/i)).toBeVisible();
  });
});
