import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Per-test language switcher. Hoisted alongside vi.mock so the mock
// factory closes over the same ref the test mutates.
const langRef = vi.hoisted(() => ({ current: 'vi' as 'vi' | 'en' }));

vi.mock('react-i18next', async () => {
  const enMod = await import('@/locales/en.json');
  const viMod = await import('@/locales/vi.json');
  type Dict = Record<string, unknown>;
  const en = (enMod.default ?? enMod) as Dict;
  const vi = (viMod.default ?? viMod) as Dict;
  const lookup = (dict: Dict, key: string): string | undefined => {
    const out = key.split('.').reduce<unknown>(
      (acc, k) =>
        acc && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[k]
          : undefined,
      dict,
    );
    return typeof out === 'string' ? out : undefined;
  };
  return {
    useTranslation: () => ({
      t: (key: string) => {
        const dict = langRef.current === 'vi' ? vi : en;
        return lookup(dict, key) ?? key;
      },
      i18n: {
        language: langRef.current,
        changeLanguage: () => Promise.resolve(),
      },
    }),
  };
});

import { ScoreBlock } from '@/components/ScoreBlock';
import { VERDICT_TABLE } from '@/lib/scoring';
import enLocale from '@/locales/en.json';
import viLocale from '@/locales/vi.json';

beforeEach(() => {
  langRef.current = 'vi';
});

describe('ScoreBlock', () => {
  describe('state 0 — zero reactions CTA', () => {
    it('renders the vi zero-state copy', () => {
      langRef.current = 'vi';
      render(
        <ScoreBlock
          score={{ state: 0, value: 0, tier: 'D', verdict: '' }}
        />,
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        viLocale.scoring.zeroState,
      );
    });

    it('renders the en zero-state copy', () => {
      langRef.current = 'en';
      render(
        <ScoreBlock
          score={{ state: 0, value: 0, tier: 'D', verdict: '' }}
        />,
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        enLocale.scoring.zeroState,
      );
    });
  });

  describe('state 1 — partial signal', () => {
    it('renders the vi partial copy with NO count interpolation', () => {
      langRef.current = 'vi';
      render(
        <ScoreBlock
          score={{ state: 1, value: 0, tier: 'D', verdict: '' }}
        />,
      );
      const node = screen.getByRole('status');
      expect(node).toHaveTextContent(viLocale.scoring.partialState);
      // Per Q3: weighted-sum threshold means a raw count display would
      // diverge from the actual gating, so the copy is countless.
      expect(node.textContent).not.toMatch(/\d+\s*\/\s*\d+/);
    });

    it('renders the en partial copy', () => {
      langRef.current = 'en';
      render(
        <ScoreBlock
          score={{ state: 1, value: 0, tier: 'D', verdict: '' }}
        />,
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        enLocale.scoring.partialState,
      );
    });
  });

  describe('state 2 — final number + tier + verdict', () => {
    it('renders value, tier letter, and the vi verdict from VERDICT_TABLE', () => {
      langRef.current = 'vi';
      render(
        <ScoreBlock
          score={{ state: 2, value: 87, tier: 'A', verdict: 'A' }}
        />,
      );
      expect(screen.getByText('87')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByRole('status').textContent).toContain(
        VERDICT_TABLE.A.vi,
      );
    });

    it('renders the en verdict from VERDICT_TABLE when language is en', () => {
      langRef.current = 'en';
      render(
        <ScoreBlock
          score={{ state: 2, value: 87, tier: 'A', verdict: 'A' }}
        />,
      );
      expect(screen.getByText('87')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByRole('status').textContent).toContain(
        VERDICT_TABLE.A.en,
      );
    });

    it('renders S-tier value 100 with the matching verdict phrase', () => {
      langRef.current = 'vi';
      render(
        <ScoreBlock
          score={{ state: 2, value: 100, tier: 'S', verdict: 'S' }}
        />,
      );
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('S')).toBeInTheDocument();
      expect(screen.getByRole('status').textContent).toContain(
        VERDICT_TABLE.S.vi,
      );
    });
  });
});
