/**
 * Security-focused unit tests.
 * These exist to prevent regressions on specific vulnerabilities found during review.
 */
import { validateFiniteVector } from '../../src/services/embedding.js';
import { sanitizeToolError } from '../../src/server-utils.js';
import { validateHfIdentifier, validateCredentialPath } from '../../src/config-validators.js';
import { truncateForLlm } from '../../src/services/summarizer.js';

describe('validateFiniteVector', () => {
  it('passes for a normal float vector', () => {
    expect(() => validateFiniteVector([0.1, -0.5, 0.99])).not.toThrow();
  });

  it('throws on NaN values', () => {
    expect(() => validateFiniteVector([0.1, NaN, 0.3])).toThrow(/non-finite/i);
  });

  it('throws on Infinity', () => {
    expect(() => validateFiniteVector([Infinity, 0.1])).toThrow(/non-finite/i);
  });

  it('throws on negative Infinity', () => {
    expect(() => validateFiniteVector([-Infinity, 0.1])).toThrow(/non-finite/i);
  });

  it('throws on empty vector', () => {
    expect(() => validateFiniteVector([])).toThrow();
  });
});

describe('sanitizeToolError', () => {
  it('strips file system paths from error messages', () => {
    const err = new Error('ENOENT: no such file or directory, open \'/Users/bob/secrets/.env\'');
    expect(sanitizeToolError(err)).not.toContain('/Users/bob');
    expect(sanitizeToolError(err)).not.toContain('.env');
  });

  it('strips stack traces', () => {
    const err = new Error('something failed');
    err.stack = 'Error: something failed\n    at embedDocument (/Users/bob/kebo-mcp/src/tools/embed-document.ts:42:5)';
    const result = sanitizeToolError(err);
    expect(result).not.toContain('at embedDocument');
    expect(result).not.toContain('/Users/bob');
  });

  it('preserves a safe user-facing message', () => {
    const err = new Error('Document not found: abc-123');
    expect(sanitizeToolError(err)).toContain('Document not found');
  });

  it('handles non-Error throws', () => {
    expect(sanitizeToolError('string error')).toBe('An unexpected error occurred');
    expect(sanitizeToolError(null)).toBe('An unexpected error occurred');
  });
});

describe('validateHfIdentifier', () => {
  it('accepts valid HuggingFace repo names', () => {
    expect(() => validateHfIdentifier('mixedbread-ai/mxbai-embed-large-v1-GGUF', 'repo')).not.toThrow();
    expect(() => validateHfIdentifier('bartowski/Phi-4-mini-instruct-GGUF', 'repo')).not.toThrow();
  });

  it('accepts valid GGUF filenames', () => {
    expect(() => validateHfIdentifier('mxbai-embed-large-v1-f16.gguf', 'file')).not.toThrow();
    expect(() => validateHfIdentifier('Phi-4-mini-instruct-Q4_K_M.gguf', 'file')).not.toThrow();
  });

  it('rejects path traversal sequences', () => {
    expect(() => validateHfIdentifier('../../etc/passwd', 'repo')).toThrow(/invalid/i);
    expect(() => validateHfIdentifier('../secrets.gguf', 'file')).toThrow(/invalid/i);
  });

  it('rejects identifiers with shell-special characters', () => {
    expect(() => validateHfIdentifier('org/repo; rm -rf /', 'repo')).toThrow(/invalid/i);
    expect(() => validateHfIdentifier('file$(whoami).gguf', 'file')).toThrow(/invalid/i);
  });
});

describe('validateCredentialPath', () => {
  it('accepts a path within the credentials directory', () => {
    expect(() => validateCredentialPath('./credentials/service-account.json')).not.toThrow();
  });

  it('rejects path traversal out of the project', () => {
    expect(() => validateCredentialPath('../../etc/passwd')).toThrow(/outside/i);
    expect(() => validateCredentialPath('/etc/passwd')).toThrow(/outside/i);
  });

  it('rejects non-JSON files', () => {
    expect(() => validateCredentialPath('./credentials/key.txt')).toThrow(/\.json/i);
  });
});

describe('truncateForLlm', () => {
  it('returns text unchanged when under the limit', () => {
    const short = 'hello world';
    expect(truncateForLlm(short)).toBe(short);
  });

  it('truncates text exceeding the character limit', () => {
    const long = 'a'.repeat(50_001);
    const result = truncateForLlm(long);
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain('[truncated]');
  });

  it('respects a custom limit', () => {
    const text = 'a'.repeat(200);
    const result = truncateForLlm(text, 100);
    expect(result.length).toBeLessThan(150);
  });
});
