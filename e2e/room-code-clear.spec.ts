import { expect, test } from '@playwright/test';

// Desktop viewport — RemoteClient renders the OTP join form (no live backend).
test.use({ viewport: { width: 1280, height: 800 } });

test.describe('home page — clear room code with Escape', () => {
  test('Escape empties the digit boxes and re-disables the Join button', async ({
    page,
  }) => {
    await page.goto('/');

    const digits = page.getByLabel(/Digit \d/);
    await expect(digits).toHaveCount(4);

    const joinButton = page.getByRole('button', { name: /Vào phòng/i });
    await expect(joinButton).toBeDisabled();

    // Type a full 4-digit code into the boxes.
    await digits.nth(0).fill('1');
    await digits.nth(1).fill('2');
    await digits.nth(2).fill('3');
    await digits.nth(3).fill('4');
    await expect(digits.nth(0)).toHaveValue('1');
    await expect(digits.nth(3)).toHaveValue('4');

    // Once 4 digits are present the code is submittable. The completion handler
    // kicks off a backend check (which never succeeds without a live backend),
    // so wait for the button to settle back to its enabled state.
    await expect(joinButton).toBeEnabled();

    // Press Escape while focused in a digit box.
    await digits.nth(3).press('Escape');

    // All boxes are empty and focus returns to the first box.
    for (let i = 0; i < 4; i++) {
      await expect(digits.nth(i)).toHaveValue('');
    }
    await expect(digits.nth(0)).toBeFocused();

    // With no digits the Join button is disabled again.
    await expect(joinButton).toBeDisabled();
  });
});
