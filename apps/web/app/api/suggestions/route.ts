import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

const CACHE_REVALIDATE_SECONDS = 3600;

// Throws on any error path so unstable_cache never stores empty/error
// responses (which would otherwise lock the route into "no suggestions"
// for the full TTL after a transient hiccup). The route handler catches
// and returns the historical empty-list shape.
async function fetchSuggestions(query: string): Promise<string[]> {
  const res = await fetch(
    `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`upstream ${res.status}`);

  // Google declares charset=ISO-8859-1 and embeds raw latin-1 bytes for some
  // Vietnamese characters (e.g. 0xF3 for ó) while escaping others as \uXXXX.
  // Forcing UTF-8 makes those raw bytes invalid → replacement chars (◆).
  // Decoding as ISO-8859-1 first preserves all bytes; JSON.parse then resolves
  // both the raw latin-1 chars and the \uXXXX escape sequences correctly.
  const buffer = await res.arrayBuffer();
  const text = new TextDecoder('iso-8859-1').decode(buffer);
  const data = JSON.parse(text);

  if (!Array.isArray(data[1])) throw new Error('unexpected upstream shape');
  return (data[1] as string[]).map((s) => s.normalize('NFC'));
}

const cachedFetchSuggestions = unstable_cache(
  fetchSuggestions,
  ['suggestions'],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['suggestions'] },
);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ suggestions: [] });

  try {
    const suggestions = await cachedFetchSuggestions(q);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
