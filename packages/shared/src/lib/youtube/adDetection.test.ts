import { describe, expect, it } from 'vitest';
import { parseVideoId } from './adDetection';

describe('parseVideoId', () => {
  it('extracts the v= id from a watch URL', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=abc123&t=4')).toBe('abc123');
  });
  it('extracts the v= id when not the first query param', () => {
    expect(parseVideoId('https://www.youtube.com/watch?list=x&v=abc123')).toBe('abc123');
  });
  it('returns null for an empty or non-watch URL', () => {
    expect(parseVideoId('')).toBeNull();
    expect(parseVideoId('https://www.youtube.com/')).toBeNull();
  });
});
