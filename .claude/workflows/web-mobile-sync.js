export const meta = {
  name: 'web-mobile-sync',
  description: 'Port 11 missing bk-web features into bk-mobile with per-feature verification',
  phases: [
    { title: 'Analyze', detail: 'Read bk-web source, produce port specs for 11 features' },
    { title: 'Implement', detail: 'Port each feature to bk-mobile (bk-web is read-only)' },
    { title: 'Verify', detail: 'Run typecheck + lint after each feature' },
    { title: 'Summary', detail: 'Write sync-results.md with outcome per feature' },
  ],
}

const REPO = '/Users/bason/Documents/bason-labs/bs-kara'

const SPEC_SCHEMA = {
  type: 'object',
  required: ['feature', 'sourceFiles', 'targetFiles', 'api', 'rnAdaptations', 'webSourceContent'],
  properties: {
    feature: { type: 'string' },
    sourceFiles: { type: 'array', items: { type: 'string' } },
    targetFiles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'action'],
        properties: {
          path: { type: 'string' },
          action: { type: 'string', enum: ['create', 'modify'] },
        },
      },
    },
    api: { type: 'string' },
    firebasePaths: { type: 'array', items: { type: 'string' } },
    sharedDeps: { type: 'array', items: { type: 'string' } },
    rnAdaptations: { type: 'array', items: { type: 'string' } },
    webSourceContent: { type: 'string' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['passed'],
  properties: {
    passed: { type: 'boolean' },
    errors: { type: 'string' },
    warnings: { type: 'string' },
  },
}
