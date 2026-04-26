import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ suggestions: [] });

  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`,
    );
    if (!res.ok) return NextResponse.json({ suggestions: [] });

    // Google declares charset=ISO-8859-1 and embeds raw latin-1 bytes for some
    // Vietnamese characters (e.g. 0xF3 for ó) while escaping others as \uXXXX.
    // Forcing UTF-8 makes those raw bytes invalid → replacement chars (◆).
    // Decoding as ISO-8859-1 first preserves all bytes; JSON.parse then resolves
    // both the raw latin-1 chars and the \uXXXX escape sequences correctly.
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder('iso-8859-1').decode(buffer);
    const data = JSON.parse(text);

    const suggestions: string[] = Array.isArray(data[1])
      ? (data[1] as string[]).map((s) => s.normalize('NFC'))
      : [];

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
