import { describe, it, expect } from 'vitest';
import { buildProofOfWorkComment } from './proofComment';

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
