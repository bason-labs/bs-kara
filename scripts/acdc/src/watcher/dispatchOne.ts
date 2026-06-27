export interface DispatchOneArgs {
  issue: number;
  tier: string | undefined;
}

// argv (process.argv.slice(2)): "<issue> [tier]" where tier is bare (high) or tier=high.
export function parseDispatchOneArgs(argv: string[]): DispatchOneArgs {
  const issue = Number(argv[0]);
  if (!Number.isInteger(issue) || issue <= 0) {
    throw new Error('usage: dispatch-one <issue> [tier]  (issue must be a positive integer)');
  }
  let tier = argv[1];
  if (tier && tier.startsWith('tier=')) tier = tier.slice('tier='.length);
  return { issue, tier };
}
