import path from 'path';

const HF_IDENTIFIER_RE = /^[a-zA-Z0-9_\-./]+$/;

/**
 * Validate a HuggingFace repo name or filename.
 * Rejects path traversal, shell metacharacters, and anything unexpected.
 */
export function validateHfIdentifier(value: string, field: 'repo' | 'file'): void {
  if (!value || value.length > 200) {
    throw new Error(`Invalid HuggingFace ${field}: empty or too long`);
  }
  if (value.includes('..') || value.startsWith('/')) {
    throw new Error(`Invalid HuggingFace ${field}: path traversal not allowed`);
  }
  if (!HF_IDENTIFIER_RE.test(value)) {
    throw new Error(`Invalid HuggingFace ${field}: contains disallowed characters`);
  }
}

/**
 * Validate the service account credential path.
 * Must be a .json file and must not traverse outside the project root.
 */
export function validateCredentialPath(credPath: string): void {
  // Check traversal before extension so the error message is accurate
  const resolved = path.resolve(process.cwd(), credPath);
  const root = process.cwd();

  if (!resolved.startsWith(root)) {
    throw new Error(`Credential path is outside the project directory`);
  }

  if (!credPath.endsWith('.json')) {
    throw new Error('Credential path must point to a .json file');
  }
}
