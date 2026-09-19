import { expect, test, type Page } from '@playwright/test';

const video = { id: 'birthday', title: 'Happy Birthday Karaoke', channel: 'Birthday Music', thumbnail: '/favicon/android-chrome-192x192.png', duration: '2:30' };

async function fixtureRoom(page: Page, voiceChatEnabled: boolean | null = true) {
  // Stub the Firebase wire boundary; no test joins or writes a real room.
  await page.routeWebSocket(/.*(?:firebaseio\.com|firebasedatabase\.app).*\.ws.*/, socket => {
    socket.send(JSON.stringify({ t: 'c', d: { t: 'h', d: { ts: Date.now(), v: '5', h: new URL(socket.url()).hostname, s: 'voice-e2e' } } }));
    socket.onMessage(raw => {
      if (typeof raw !== 'string' || !raw.startsWith('{')) return;
      const message = JSON.parse(raw);
      if (message.t !== 'd') return;
      const { r, a, b } = message.d;
      if (a === 'q' || a === 'g') {
        const data = b.p === '/rooms/2048' ? {
          currentPlaying: { ...video, id: 'current', title: 'Nối vòng tay lớn' },
          isPlaying: true, isMCEnabled: false, requesterPromptEnabled: false, isTvActive: true,
          ...(voiceChatEnabled === null ? {} : { voiceChatEnabled }),
        } : null;
        if (a === 'q') socket.send(JSON.stringify({ t: 'd', d: { a: 'd', b: { p: b.p, d: data } } }));
        socket.send(JSON.stringify({ t: 'd', d: { r, b: { s: 'ok', d: a === 'g' ? data : '' } } }));
      } else socket.send(JSON.stringify({ t: 'd', d: { r, b: { s: 'ok', d: '' } } }));
    });
  });
  await page.route('**/api/youtube/search?**', route => route.fulfill({ json: [video] }));
  await page.route('**/api/suggestions?**', route => route.fulfill({ json: [] }));
  await page.route('**/api/voice/session', route => route.fulfill({ json: { sessionId: 'e2e-session', token: 'e2e-token' } }));
  await page.route('**/api/voice/transcribe', route => route.fulfill({ json: { text: 'Mình muốn hát Happy Birthday' } }));
  await page.route('**/api/tts', route => route.fulfill({ status: 503, json: { audioContent: null } }));
  await page.addInitScript(() => {
    localStorage.setItem('karaoke_theme', 'light');
    const stream = { getTracks: () => [{ stop() {} }] };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => stream } });
    class Recorder {
      static isTypeSupported() { return true; }
      state = 'inactive'; mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) }); this.onstop?.(); }
    }
    class Context {
      state = 'running';
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createAnalyser() {
        let samples = 0;
        return { fftSize: 2048, disconnect() {}, getByteTimeDomainData(data: Uint8Array) { data.fill(samples++ < 2 ? 145 : 128); } };
      }
      async close() {} async resume() {}
    }
    Object.defineProperty(window, 'MediaRecorder', { value: Recorder });
    Object.defineProperty(window, 'AudioContext', { value: Context });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [], cancel() {}, resume() {}, addEventListener() {}, removeEventListener() {},
      speak(utterance: SpeechSynthesisUtterance) { utterance.onstart?.(new Event('start') as SpeechSynthesisEvent); queueMicrotask(() => utterance.onend?.(new Event('end') as SpeechSynthesisEvent)); },
    } });
  });
}

test.describe('Voice Chat', () => {
  test('disabled by default hides the mode selector and activates manual search', async ({ page }) => {
    await fixtureRoom(page, null);
    await page.goto('/?room=2048&mode=voice');

    await expect(page.getByPlaceholder('Tìm kiếm bài hát...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voice Chat', exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(/mode=manual/);
  });

  test('small dark viewport keeps manual and voice controls within the screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await fixtureRoom(page);
    await page.addInitScript(() => localStorage.setItem('karaoke_theme', 'dark'));
    await page.goto('/?room=2048&mode=voice');
    await expect(page.getByRole('button', { name: 'Bắt đầu nói', exact: true })).toBeVisible();
    await expect(page.getByRole('log')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/voice-chat-small-dark.png', fullPage: true });
    await page.getByRole('button', { name: 'Thủ công', exact: true }).click();
    await expect(page).toHaveURL(/mode=manual/);
    const result = page.getByText('Happy Birthday Karaoke', { exact: true });
    await expect(result).toBeVisible();
    await expect.poll(async () => {
      const search = await page.getByPlaceholder('Tìm kiếm bài hát...').boundingBox();
      const row = await result.boundingBox();
      return !!search && !!row && row.y >= search.y + search.height;
    }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/voice-chat-manual-small.png', fullPage: true });
  });

  test('spoken search, numbered selection, and switching modes preserve the conversation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await fixtureRoom(page);
    let selections = 0;
    await page.route('**/api/voice/turn', async route => {
      const body = route.request().postDataJSON();
      if (body.selection) {
        expect(body.selection).toEqual({ searchId: 'search-1', position: 1 });
        selections++;
        await route.fulfill({ json: { reply: 'Đã thêm Happy Birthday vào hàng chờ.', receipt: { status: 'queued', video } } });
      } else await route.fulfill({ json: { reply: 'Bạn muốn chọn bản nào?', results: { searchId: 'search-1', videos: [video] } } });
    });
    await page.goto('/?room=2048&mode=voice');
    await page.getByRole('button', { name: 'Bắt đầu nói', exact: true }).click();
    await expect(page.getByText('Bạn muốn chọn bản nào?', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '1. Happy Birthday Karaoke', exact: true }).click();
    await expect(page.getByText('Đã thêm Happy Birthday vào hàng chờ.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Thủ công', exact: true }).click();
    await expect(page).toHaveURL(/mode=manual/);
    await page.getByRole('button', { name: 'Voice Chat', exact: true }).click();
    await expect(page.getByText('Đã thêm Happy Birthday vào hàng chờ.', { exact: true })).toBeVisible();
    expect(selections).toBe(1);
    await expect(page.getByRole('button', { name: '1. Happy Birthday Karaoke', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/voice-chat-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.getByRole('log')).toBeVisible();
    await page.screenshot({ path: 'test-results/voice-chat-desktop.png', fullPage: true });
    expect(errors).toEqual([]);
  });

  test('spoken ordinal follows search without touching a result', async ({ page }) => {
    await fixtureRoom(page);
    let recordings = 0;
    let choices = 0;
    await page.route('**/api/voice/transcribe', route => route.fulfill({ json: { text: ++recordings === 1 ? 'Happy Birthday' : 'Bài đầu tiên' } }));
    await page.route('**/api/voice/turn', route => {
      const body = route.request().postDataJSON();
      expect(body.selection).toBeUndefined();
      if (body.text === 'Happy Birthday') return route.fulfill({ json: { reply: 'Bạn chọn bài số mấy?', results: { searchId: 'spoken', videos: [video] } } });
      expect(body.text).toBe('Bài đầu tiên');
      choices++;
      return route.fulfill({ json: { reply: 'Đã thêm bài đầu tiên.', receipt: { status: 'queued', video } } });
    });
    await page.goto('/?room=2048&mode=voice');
    await page.getByRole('button', { name: 'Bắt đầu nói', exact: true }).click();
    await expect(page.getByText('Đã thêm bài đầu tiên.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Dừng lắng nghe', exact: true }).click();
    expect(recordings).toBe(2);
    expect(choices).toBe(1);
  });

  test('stopping capture does not submit a turn', async ({ page }) => {
    await fixtureRoom(page);
    let turns = 0;
    await page.route('**/api/voice/turn', route => { turns++; return route.fulfill({ json: { reply: 'Unexpected' } }); });
    await page.goto('/?room=2048&mode=voice');
    await page.getByRole('button', { name: 'Bắt đầu nói', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đang nghe...' })).toBeVisible();
    await page.getByRole('button', { name: 'Dừng lắng nghe', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Mic đã tắt' })).toBeVisible();
    expect(turns).toBe(0);
  });
});
