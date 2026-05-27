import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cssPath = resolve(process.cwd(), 'app/globals.css');
const css = readFileSync(cssPath, 'utf8');

describe('globals.css — iOS input zoom suppression', () => {
  it('does not let iOS Safari auto-zoom when a form field is focused on a touch device', () => {
    // iOS Safari zooms whenever a focused input/textarea/select has computed
    // font-size < 16px. The mobile search bar uses Tailwind `text-sm` (14px),
    // which previously triggered the zoom. The fix is a media query that
    // bumps form fields to ≥16px on coarse-pointer devices.
    const mediaQueryStart = css.search(
      /@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)\s*\{/,
    );
    expect(mediaQueryStart, 'expected coarse-pointer media query').toBeGreaterThanOrEqual(0);

    const slice = css.slice(mediaQueryStart, mediaQueryStart + 400);
    expect(slice).toMatch(/input/);
    expect(slice).toMatch(/textarea/);
    expect(slice).toMatch(/select/);
    expect(slice).toMatch(/font-size:\s*16px/);
  });
});
