# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: remote-mobile.spec.ts >> home page (mobile) >> skips the OTP form on coarse-pointer devices
- Location: e2e/remote-mobile.spec.ts:8:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByLabel(/Digit \d/)
Expected: 0
Received: 4
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByLabel(/Digit \d/)
    9 × locator resolved to 4 elements
      - unexpected value "4"

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - alert [ref=e2]
  - main [ref=e3]:
    - radiogroup "Giao diện" [ref=e5]:
      - radio "Sáng" [ref=e6] [cursor=pointer]:
        - img [ref=e7]
      - radio "Hệ thống" [checked] [ref=e13] [cursor=pointer]:
        - img [ref=e14]
      - radio "Tối" [ref=e16] [cursor=pointer]:
        - img [ref=e17]
    - generic [ref=e19]:
      - paragraph [ref=e20]: BS Kara
      - heading "BS Kara" [level=1] [ref=e21]
      - paragraph [ref=e22]: Hát cùng nhau. Từ mọi chiếc điện thoại.
      - generic [ref=e23]:
        - button "Tham gia phòng đang mở · 9037" [ref=e24] [cursor=pointer]
        - generic [ref=e25]: Mã phòng
        - group "Mã phòng" [ref=e26]:
          - textbox "Digit 1" [active] [ref=e27]
          - textbox "Digit 2" [ref=e28]
          - textbox "Digit 3" [ref=e29]
          - textbox "Digit 4" [ref=e30]
        - button "Vào phòng" [disabled] [ref=e31]
        - paragraph [ref=e32]:
          - img [ref=e33]
          - text: Hoặc quét mã QR hiển thị trên TV
```

# Test source

```ts
  1  | import { devices, expect, test } from '@playwright/test';
  2  | 
  3  | // Mobile viewport: RemoteClient skips the OTP form and shows the
  4  | // "starting room" spinner while it tries to claim/attach to a room.
  5  | test.use({ ...devices['iPhone 13'] });
  6  | 
  7  | test.describe('home page (mobile)', () => {
  8  |   test('skips the OTP form on coarse-pointer devices', async ({ page }) => {
  9  |     await page.goto('/');
  10 |     // Wait briefly to ensure the post-mount coarse-pointer detection has run.
  11 |     await page.waitForTimeout(500);
  12 |     // The OTP digits are not rendered for mobile.
> 13 |     await expect(page.getByLabel(/Digit \d/)).toHaveCount(0);
     |                                               ^ Error: expect(locator).toHaveCount(expected) failed
  14 |   });
  15 | 
  16 |   test('shows the starting-room spinner copy while attaching', async ({ page }) => {
  17 |     await page.goto('/');
  18 |     // vi.json: home.startingRoom = "Đang mở phòng karaoke…"
  19 |     await expect(page.getByText(/Đang mở phòng/i)).toBeVisible({ timeout: 10_000 });
  20 |   });
  21 | });
  22 | 
```