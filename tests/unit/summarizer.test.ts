import { parseSummaryJson, buildSummaryPrompt } from '../../src/services/summarizer.js';
import type { StructuredSummary } from '../../src/types.js';

describe('parseSummaryJson', () => {
  it('parses a valid complete summary', () => {
    const json = JSON.stringify({
      industry: 'fintech',
      tech_stack: ['React', 'AWS Lambda', 'PostgreSQL'],
      budget_tier: 'enterprise',
      cloud_providers: ['AWS'],
      engagement_type: 'greenfield',
    });
    const result = parseSummaryJson(json);
    expect(result.industry).toBe('fintech');
    expect(result.tech_stack).toEqual(['React', 'AWS Lambda', 'PostgreSQL']);
    expect(result.budget_tier).toBe('enterprise');
    expect(result.cloud_providers).toEqual(['AWS']);
    expect(result.engagement_type).toBe('greenfield');
  });

  it('parses JSON embedded in markdown code fences', () => {
    const raw = '```json\n{"industry":"healthcare","tech_stack":["Python"],"budget_tier":"smb","cloud_providers":["Azure"],"engagement_type":"migration"}\n```';
    const result = parseSummaryJson(raw);
    expect(result.industry).toBe('healthcare');
    expect(result.budget_tier).toBe('smb');
  });

  it('normalises budget_tier to valid enum', () => {
    const json = JSON.stringify({
      industry: 'retail',
      tech_stack: ['Shopify'],
      budget_tier: 'Enterprise', // capitalised — LLM might do this
      cloud_providers: [],
      engagement_type: 'support',
    });
    const result = parseSummaryJson(json);
    expect(result.budget_tier).toBe('enterprise');
  });

  it('normalises engagement_type to valid enum', () => {
    const json = JSON.stringify({
      industry: 'logistics',
      tech_stack: ['Java'],
      budget_tier: 'startup',
      cloud_providers: ['GCP'],
      engagement_type: 'Staff Augmentation', // LLM variation
    });
    const result = parseSummaryJson(json);
    expect(result.engagement_type).toBe('augmentation');
  });

  it('throws on completely unparseable output', () => {
    expect(() => parseSummaryJson('I could not determine the summary.')).toThrow();
  });

  it('throws when required fields are missing', () => {
    expect(() => parseSummaryJson(JSON.stringify({ industry: 'tech' }))).toThrow();
  });
});

describe('buildSummaryPrompt', () => {
  it('includes the document text in the prompt', () => {
    const prompt = buildSummaryPrompt('Client uses Kubernetes on GCP');
    expect(prompt).toContain('Kubernetes');
    expect(prompt).toContain('GCP');
  });

  it('asks for a JSON object with the required fields', () => {
    const prompt = buildSummaryPrompt('some text');
    expect(prompt).toContain('budget_tier');
    expect(prompt).toContain('tech_stack');
    expect(prompt).toContain('engagement_type');
    expect(prompt).toContain('cloud_providers');
  });

  it('instructs the LLM not to reveal client identity', () => {
    const prompt = buildSummaryPrompt('some text');
    expect(prompt.toLowerCase()).toMatch(/no.*client|client.*name|do not.*identify/);
  });
});
