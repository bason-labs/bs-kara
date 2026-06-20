export interface ProofCommentInput {
  serverUrl: string;
  owner: string;
  repo: string;
  runId: string;
  artifactName: string;
}

export function buildProofOfWorkComment(i: ProofCommentInput): string {
  const runUrl = `${i.serverUrl}/${i.owner}/${i.repo}/actions/runs/${i.runId}`;
  return [
    '🎥 **Proof-of-work**',
    '',
    `Playwright report + recorded video for this run → ${runUrl}`,
    `(download the \`${i.artifactName}\` artifact).`,
  ].join('\n');
}

/** Builds ProofCommentInput from process env. Throws on a malformed GITHUB_REPOSITORY. */
export function parseProofCommentEnv(
  env: NodeJS.ProcessEnv,
  artifactName = 'playwright-report',
): ProofCommentInput {
  const fullRepo = env.GITHUB_REPOSITORY || 'bason-labs/bs-kara';
  const [owner, repo] = fullRepo.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY: "${fullRepo}" (expected "owner/repo")`);
  }
  return {
    serverUrl: env.GITHUB_SERVER_URL || 'https://github.com',
    owner,
    repo,
    runId: env.GITHUB_RUN_ID || '0',
    artifactName,
  };
}
