import { describe, it, expect } from 'vitest';
import { buildProofOfWorkComment, parseProofCommentEnv } from './proofComment';

describe('buildProofOfWorkComment', () => {
  it('includes the run URL and the artifact name', () => {
    const body = buildProofOfWorkComment({
      serverUrl: 'https://github.com',
      owner: 'bason-labs',
      repo: 'bs-kara',
      runId: '12345',
      artifactName: 'playwright-report',
    });
    expect(body).toContain('https://github.com/bason-labs/bs-kara/actions/runs/12345');
    expect(body).toContain('playwright-report');
    expect(body).toContain('Proof-of-work');
  });
});

describe('parseProofCommentEnv', () => {
  it('parses owner/repo/runId from GITHUB_* env', () => {
    const r = parseProofCommentEnv({
      GITHUB_REPOSITORY: 'bason-labs/bs-kara',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_RUN_ID: '999',
    } as NodeJS.ProcessEnv);
    expect(r).toEqual({
      serverUrl: 'https://github.com',
      owner: 'bason-labs',
      repo: 'bs-kara',
      runId: '999',
      artifactName: 'playwright-report',
    });
  });

  it('falls back to the default repo when GITHUB_REPOSITORY is empty (no "undefined" repo)', () => {
    const r = parseProofCommentEnv({ GITHUB_REPOSITORY: '' } as NodeJS.ProcessEnv);
    expect(r.owner).toBe('bason-labs');
    expect(r.repo).toBe('bs-kara');
  });

  it('throws on a GITHUB_REPOSITORY with no slash', () => {
    expect(() => parseProofCommentEnv({ GITHUB_REPOSITORY: 'no-slash' } as NodeJS.ProcessEnv)).toThrow(
      /Invalid GITHUB_REPOSITORY/,
    );
  });
});
