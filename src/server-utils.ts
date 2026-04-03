// Patterns that may reveal internal system details
const SENSITIVE_PATTERNS = [
  /\/[a-zA-Z0-9._~-]+(\/[a-zA-Z0-9._~-]+)+/g, // unix file paths
  /[A-Z]:\\[^"'\s]*/g,                           // windows paths
  /\n\s+at .+\(.+\)/g,                           // stack trace frames
];

const SAFE_ERROR_MESSAGES = new Set([
  'Document not found',
  'Could not parse summary JSON',
  'Embedding dimension mismatch',
  'Vector length mismatch',
  'Cannot compute similarity',
]);

/**
 * Convert any thrown value into a safe string for the MCP client.
 * Strips file paths, stack traces, and other internal details.
 */
export function sanitizeToolError(err: unknown): string {
  if (!(err instanceof Error)) {
    return 'An unexpected error occurred';
  }

  let message = err.message;

  // Keep the message if it starts with a known safe prefix
  const isSafe = [...SAFE_ERROR_MESSAGES].some((safe) => message.startsWith(safe));
  if (!isSafe) {
    // Strip sensitive patterns from the message text
    for (const pattern of SENSITIVE_PATTERNS) {
      message = message.replace(pattern, '[redacted]');
    }
  }

  // Never include the stack trace
  return message.split('\n')[0] ?? 'An unexpected error occurred';
}
