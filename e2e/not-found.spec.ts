import { expect, test } from '@playwright/test';

test.describe('routing and error pages', () => {
  test('an unknown path renders the 404 page with a back-to-home link', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByRole('link', { name: /Về trang chủ|Back to home/i })).toBeVisible();
  });

  test('the metadata routes respond', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    expect((await sitemap.text())).toContain('<urlset');

    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    expect((await robots.text())).toMatch(/User-Agent: \*/i);
  });
});
