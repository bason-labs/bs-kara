export interface GreenStep {
  name: 'build' | 'check' | 'e2e';
  cmd: string;
}

export const GREEN_BAR: GreenStep[] = [
  { name: 'build', cmd: 'pnpm exec turbo run build --filter=@bs-kara/web --filter=@bs-kara/acdc' },
  {
    name: 'check',
    cmd: 'pnpm exec turbo run typecheck lint test --filter=@bs-kara/web --filter=@bs-kara/acdc',
  },
  { name: 'e2e', cmd: 'CI=1 pnpm exec playwright test --project=chromium --grep-invert "@live"' },
];
