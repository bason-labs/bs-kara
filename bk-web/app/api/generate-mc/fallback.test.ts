import { describe, expect, it } from 'vitest';
import { buildFallbackMC } from './fallback';

describe('buildFallbackMC', () => {
  // Bare case used when the provider failed and we have nothing but the
  // song title. Must NOT fabricate names — that's the bug class the whole
  // anti-fabrication work was built to prevent. The honorific-then-uppercase
  // pattern (anh/chị/cô/chú/em + capital letter) is the specific shape the
  // model was hallucinating ("anh Hải và chị Lan").
  it('returns a line containing the song title and no fabricated names when only songTitle is given', () => {
    const out = buildFallbackMC({ songTitle: 'Giã Từ' });
    expect(out).toContain('Giã Từ');
    expect(out).not.toMatch(/(anh|chị|cô|chú|em)\s+\p{Lu}/u);
  });

  it('includes all three values when songTitle, originalArtist, and performerName are provided', () => {
    const out = buildFallbackMC({
      songTitle: 'Diễm Xưa',
      originalArtist: 'Khánh Ly',
      performerName: 'Anh Tuấn',
    });
    expect(out).toContain('Diễm Xưa');
    expect(out).toContain('Khánh Ly');
    expect(out).toContain('Anh Tuấn');
  });

  // Multi-performer is parsed using the same separator regex as the LLM
  // path (comma / & / và / and). The fallback joins them with " và " so
  // the rendered MC line reads naturally instead of "Tuấn, Lan" mid-
  // sentence.
  it('joins multi-performer names with " và "', () => {
    const out = buildFallbackMC({ songTitle: 'X', performerName: 'Tuấn, Lan' });
    expect(out).toContain('Tuấn và Lan');
    expect(out).not.toContain('Tuấn, Lan');
  });

  it('joins multi-performer names split by "&" or "và" with " và "', () => {
    const out = buildFallbackMC({
      songTitle: 'X',
      performerName: 'An & Bình và Cường',
    });
    expect(out).toContain('An và Bình và Cường');
  });

  // String literals "null" / "undefined" sometimes leak through from
  // upstream serialization (e.g. JSON.stringify(undefined) or templating
  // bugs). Treating them as missing matches what the route already does
  // for actually-null/undefined values, so the fallback path doesn't
  // render the literal word "null" into the MC line.
  it('treats "null" / "undefined" / empty / whitespace-only strings as missing', () => {
    const out = buildFallbackMC({
      songTitle: 'X',
      originalArtist: 'null',
      performerName: '   ',
    });
    expect(out).not.toContain('null');
    expect(out).not.toContain('undefined');
    // Falls through to the bare-case templates → must not invent names.
    expect(out).not.toMatch(/(anh|chị|cô|chú|em)\s+\p{Lu}/u);
  });
});
