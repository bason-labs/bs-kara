import { expect, test } from '@playwright/test';

test.describe('/tv display', () => {
  test('renders the waiting overlay with room label and start prompt', async ({ page }) => {
    await page.goto('/tv');
    await expect(page.getByText(/BS Kara/i).first()).toBeVisible();
    // vi.json: tv.startPrompt = "Nhấn vào bất kỳ đâu hoặc bấm phím để bắt đầu…"
    await expect(page.getByText(/Nhấn vào bất kỳ đâu/i)).toBeVisible({ timeout: 10_000 });
  });

  test('right-side queue panel shows the empty-queue message', async ({ page }) => {
    await page.goto('/tv');
    // vi.json: tv.emptyQueueMessage = "Hàng chờ trống"
    await expect(page.getByText(/Hàng chờ trống/i)).toBeVisible({ timeout: 10_000 });
  });

  test('an "End Party" button is present in the sidebar', async ({ page }) => {
    await page.goto('/tv');
    // The same Vietnamese label "Kết thúc" appears on both the sidebar button
    // and the ConfirmDialog's confirm button (the dialog is rendered inert
    // when closed). Scope to the sidebar via the parent <aside>.
    const sidebar = page.getByRole('complementary', { name: /Queue/i });
    await expect(sidebar.getByRole('button', { name: /Kết thúc/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});
