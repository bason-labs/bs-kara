// Template-based MC line used when the LLM call fails (abort, timeout,
// rate limit, parse error, sanitizer-empty result, misconfigured
// provider). The user must never see a hard failure in the karaoke UI —
// they get one of these every time the LLM path can't produce a usable
// line. See route.ts for the catch-path wiring and the
// `[generate-mc] fallback used:` log prefix used by monitoring.

interface FallbackVars {
  songTitle: string;
  originalArtist?: string | null;
  performerName?: string | null;
}

// Mirrors the LLM-path separator regex so multi-performer inputs are
// parsed identically on both code paths. ASCII `\b` won't anchor against
// Vietnamese diacritics, so word separators require explicit whitespace.
const MULTI_PERFORMER_SPLIT = /\s*,\s*|\s*&\s*|\s+(?:và|and)\s+/iu;

export function splitPerformers(raw: string): string[] {
  return raw
    .split(MULTI_PERFORMER_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Treats empty / whitespace / literal "null" / "undefined" strings as
// missing. The literal-string filter catches upstream serialization bugs
// (e.g. JSON.stringify(undefined) or template engines emitting "null")
// that would otherwise leak the word "null" into a user-facing MC line.
export function nullIfBlank(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return t;
}

// Templates use {title} / {artist} / {performer} placeholders. Each
// placeholder appears at most once per template; pick one at random per
// call so successive fallbacks don't read identically.
const TEMPLATES_WITH_ARTIST_AND_PERFORMER = [
  "Sau đây xin mời {performer} thể hiện ca khúc '{title}' — bản hit gắn liền với tên tuổi của {artist}. Một tràng pháo tay nào cả nhà!",
  "Tiếp theo chương trình, '{title}' — nhạc phẩm nổi tiếng của {artist} — sẽ được {performer} gửi đến quý vị. Xin mời!",
  "'{title}' của {artist} đã sẵn sàng. Sân khấu giờ là của {performer} — mời bạn cất giọng!",
  "Một ca khúc quen thuộc qua giọng ca {artist} — '{title}' — sắp được {performer} thể hiện. Xin một tràng pháo tay thật lớn!",
];

const TEMPLATES_WITH_ARTIST_ONLY = [
  "Sau đây xin mời quý vị cùng thưởng thức ca khúc '{title}' — một sáng tác gắn liền với tên tuổi của {artist}. Mời ca sĩ tiếp theo của chúng ta lên sân khấu!",
  "Tiếp theo chương trình, xin gửi đến quý vị nhạc phẩm '{title}' — bản hit của {artist}. Mời vị khách đã chọn bài này cất giọng nào!",
  "'{title}' — ca khúc nổi tiếng qua giọng ca {artist} — đang chờ được vang lên. Sân khấu giờ là của bạn!",
  "Xin mời cả nhà cùng lắng nghe '{title}' — một tác phẩm quen thuộc của {artist}. Người chọn bài này, mời lên sân khấu!",
];

const TEMPLATES_WITH_PERFORMER_ONLY = [
  "Sau đây xin mời {performer} thể hiện ca khúc '{title}'. Một tràng pháo tay nào cả nhà!",
  "'{title}' đã sẵn sàng — mời {performer} bước lên sân khấu cất giọng!",
  "Tiếp theo chương trình, xin gửi đến quý vị ca khúc '{title}' qua phần trình bày của {performer}. Xin mời!",
  "Sân khấu giờ là của {performer} với ca khúc '{title}'. Cả nhà cùng cổ vũ nào!",
];

const TEMPLATES_BARE = [
  "Sau đây xin mời bạn cùng thưởng thức ca khúc '{title}'. Một tràng pháo tay cho ca sĩ tiếp theo của chúng ta!",
  "Tiếp theo chương trình, xin gửi đến quý vị nhạc phẩm '{title}'. Mời người chọn bài lên sân khấu!",
  "'{title}' đã sẵn sàng — mời vị khách đã chọn ca khúc này cất giọng nào!",
  "Một ca khúc thú vị đang chờ phía trước — '{title}'. Sân khấu giờ là của bạn!",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

export function buildFallbackMC(vars: FallbackVars): string {
  const title = vars.songTitle;
  const artist = nullIfBlank(vars.originalArtist);
  let performer = nullIfBlank(vars.performerName);

  if (performer) {
    const parts = splitPerformers(performer);
    if (parts.length > 1) performer = parts.join(' và ');
  }

  if (artist && performer) {
    return fill(pick(TEMPLATES_WITH_ARTIST_AND_PERFORMER), {
      title,
      artist,
      performer,
    });
  }
  if (artist) {
    return fill(pick(TEMPLATES_WITH_ARTIST_ONLY), { title, artist });
  }
  if (performer) {
    return fill(pick(TEMPLATES_WITH_PERFORMER_ONLY), { title, performer });
  }
  return fill(pick(TEMPLATES_BARE), { title });
}
