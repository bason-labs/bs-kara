type Scope =
  | 'route-error'
  | 'global-error'
  | 'not-found'
  | 'youtube'
  | 'suggestions';

export function logError(
  scope: Scope,
  error: unknown,
  context?: Record<string, unknown>,
) {
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? (error as { digest?: string }).digest
      : undefined;

  console.error(`[${scope}]`, {
    message: error instanceof Error ? error.message : String(error),
    digest,
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  });
}
