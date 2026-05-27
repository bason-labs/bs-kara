import { http, HttpResponse } from 'msw';

// Default handlers cover the in-app BFF routes called from the client. Tests
// override individual routes with `server.use(...)` for failure scenarios.
export const handlers = [
  http.get('*/api/youtube/search', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    if (!q) return HttpResponse.json({ error: 'missing_query' }, { status: 400 });
    return HttpResponse.json([
      {
        id: 'mock-video-1',
        title: `Mock result for ${q}`,
        channel: 'Mock Channel',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: '3:45',
      },
    ]);
  }),

  http.get('*/api/search', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    if (!q) return HttpResponse.json([]);
    return HttpResponse.json([
      {
        id: 'mock-scrape-1',
        title: `Scraped: ${q}`,
        channel: 'Scraper',
        thumbnail: 'https://example.com/scrape.jpg',
        duration: '4:00',
      },
    ]);
  }),

  http.get('*/api/suggestions', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    if (!q) return HttpResponse.json({ suggestions: [] });
    return HttpResponse.json({
      suggestions: [`${q} karaoke`, `${q} beat`, `${q} tone nam`],
    });
  }),

  http.post('*/api/tts', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      text?: string;
      voiceName?: string;
    };
    if (!body.text) return HttpResponse.json({ audioContent: null }, { status: 400 });
    return HttpResponse.json({ audioContent: 'BASE64MOCK' });
  }),

  http.post('*/api/generate-mc', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      songTitle?: string;
    };
    if (!body.songTitle) return HttpResponse.json({ text: null }, { status: 400 });
    return HttpResponse.json({ text: 'Mock MC line!' });
  }),
];
