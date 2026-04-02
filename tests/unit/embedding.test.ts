import { cosineSimilarity, validateEmbeddingDimensions } from '../../src/services/embedding.js';

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const v = [0.1, 0.5, 0.8, 0.3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it('handles real-valued vectors', () => {
    const a = [0.2, 0.7, 0.1];
    const b = [0.3, 0.6, 0.2];
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.9); // similar direction
    expect(sim).toBeLessThanOrEqual(1.0);
  });

  it('throws when vectors have different lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });

  it('throws on zero-magnitude vector', () => {
    expect(() => cosineSimilarity([0, 0], [1, 0])).toThrow();
  });
});

describe('validateEmbeddingDimensions', () => {
  it('passes when dimensions match', () => {
    expect(() => validateEmbeddingDimensions([1, 2, 3], 3)).not.toThrow();
  });

  it('throws when dimensions do not match', () => {
    expect(() => validateEmbeddingDimensions([1, 2, 3], 1024)).toThrow(/dimension/i);
  });

  it('throws on empty vector', () => {
    expect(() => validateEmbeddingDimensions([], 1024)).toThrow();
  });
});
