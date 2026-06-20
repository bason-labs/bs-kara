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
