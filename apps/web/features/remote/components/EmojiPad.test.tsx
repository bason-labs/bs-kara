import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REACTIONS } from '@bs-kara/shared';
import { EmojiPad } from './EmojiPad';

describe('EmojiPad', () => {
  it('forwards the clicked emoji into onSendEmoji', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<EmojiPad onSendEmoji={onSend} />);
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(onSend).toHaveBeenCalledWith(REACTIONS[0]);
  });

  it('renders a static SVG per reaction by default and never preloads any GIF', () => {
    render(<EmojiPad onSendEmoji={() => {}} />);
    const imgs = screen.getAllByRole('img') as HTMLImageElement[];
    expect(imgs).toHaveLength(REACTIONS.length);
    for (const img of imgs) {
      expect(img.src).toMatch(/\.svg$/);
      expect(img.src).not.toMatch(/\.gif$/);
    }
  });

  it('swaps the hovered emoji from .svg to .gif and reverts on mouse leave', async () => {
    const user = userEvent.setup();
    render(<EmojiPad onSendEmoji={() => {}} />);
    const target = REACTIONS[0];
    const button = screen.getAllByRole('button')[0];

    expect(
      (screen.getByRole('img', { name: target }) as HTMLImageElement).src,
    ).toMatch(/\.svg$/);

    await user.hover(button);
    await waitFor(() => {
      expect(
        (screen.getByRole('img', { name: target }) as HTMLImageElement).src,
      ).toMatch(/\.gif$/);
    });

    await user.unhover(button);
    await waitFor(() => {
      expect(
        (screen.getByRole('img', { name: target }) as HTMLImageElement).src,
      ).toMatch(/\.svg$/);
    });
  });

  it('only one emoji shows the .gif at a time when hover moves between items', async () => {
    const user = userEvent.setup();
    render(<EmojiPad onSendEmoji={() => {}} />);
    const buttons = screen.getAllByRole('button');

    await user.hover(buttons[0]);
    await user.hover(buttons[1]);

    const imgs = screen.getAllByRole('img') as HTMLImageElement[];
    expect(imgs).toHaveLength(REACTIONS.length);
    const gifs = imgs.filter((i) => i.src.endsWith('.gif'));
    const svgs = imgs.filter((i) => i.src.endsWith('.svg'));
    expect(gifs).toHaveLength(1);
    expect(svgs).toHaveLength(REACTIONS.length - 1);
    expect(gifs[0].alt).toBe(REACTIONS[1]);
  });

  describe('with prefers-reduced-motion: reduce', () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('never swaps to a GIF on hover when reduced-motion is requested', async () => {
      window.matchMedia = ((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;

      const user = userEvent.setup();
      render(<EmojiPad onSendEmoji={() => {}} />);
      await user.hover(screen.getAllByRole('button')[0]);

      const imgs = screen.getAllByRole('img') as HTMLImageElement[];
      expect(imgs).toHaveLength(REACTIONS.length);
      for (const img of imgs) {
        expect(img.src).toMatch(/\.svg$/);
        expect(img.src).not.toMatch(/\.gif$/);
      }
    });
  });
});
