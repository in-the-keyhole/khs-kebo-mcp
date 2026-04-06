import { parseSummaryJson, buildSummaryPrompt, generateSummary, stripKeyholePreamble } from '../../src/services/summarizer.js';
import type { StructuredSummary } from '../../src/types.js';

describe('generateSummary', () => {
  it('passes the full document text to the generate function', async () => {
    const capturedPrompts: string[] = [];
    const mockGenerate = async (prompt: string) => {
      capturedPrompts.push(prompt);
      return JSON.stringify({
        industry: 'fintech', tech_stack: ['React'], budget_tier: 'smb',
        cloud_providers: ['AWS'], engagement_type: 'greenfield',
      });
    };

    await generateSummary('Client needs React on AWS for their fintech app.', mockGenerate);
    expect(capturedPrompts[0]).toContain('React on AWS');
  });

  it('each call receives its own prompt — no shared session state', async () => {
    // Regression: if a single chat session is reused across calls, the second
    // call sees the first call's response in its history and copies it.
    const capturedPrompts: string[] = [];
    const responses = [
      { industry: 'fintech', tech_stack: ['React'], budget_tier: 'smb' as const, cloud_providers: ['AWS'], engagement_type: 'greenfield' as const },
      { industry: 'healthcare', tech_stack: ['Python'], budget_tier: 'enterprise' as const, cloud_providers: ['GCP'], engagement_type: 'migration' as const },
    ];
    let callCount = 0;
    const mockGenerate = async (prompt: string) => {
      capturedPrompts.push(prompt);
      return JSON.stringify(responses[callCount++]);
    };

    const result1 = await generateSummary('Fintech app using React on AWS', mockGenerate);
    const result2 = await generateSummary('Healthcare migration using Python on GCP', mockGenerate);

    // Each call must receive a fresh prompt containing only its own document
    expect(capturedPrompts[0]).toContain('Fintech app using React');
    expect(capturedPrompts[0]).not.toContain('Healthcare migration');
    expect(capturedPrompts[1]).toContain('Healthcare migration');
    expect(capturedPrompts[1]).not.toContain('Fintech app using React');

    // Results must differ — not a copy of the first response
    expect(result1.industry).toBe('fintech');
    expect(result2.industry).toBe('healthcare');
    expect(result1.tech_stack).not.toEqual(result2.tech_stack);
  });
});

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

  it('explicitly warns the LLM to ignore consulting firm boilerplate', () => {
    // Regression: without this, the LLM extracts Keyhole's own tech stack
    // (Java, .NET, JavaScript, Azure, AWS) from the "About Keyhole" section
    // present in every SOW, producing identical summaries for all documents.
    const prompt = buildSummaryPrompt('some text');
    expect(prompt.toLowerCase()).toMatch(/ignore|boilerplate|about keyhole/);
  });

  it('tells the LLM to extract client-project-specific tech, not consulting firm capabilities', () => {
    const prompt = buildSummaryPrompt('some text');
    expect(prompt.toLowerCase()).toMatch(/specific.*project|client.*project|project.*requirement/);
  });

  it('includes boilerplate-heavy SOW doc without burying the client tech instruction', () => {
    const keyholeSow = `
About Keyhole Software
Core competencies include Java, .NET, JavaScript, as well as cloud technologies such as Azure and AWS.

Project Requirements
The client needs a React Native mobile app with a Python/FastAPI backend deployed on GCP.
Budget: $2.1M over 18 months.
    `.trim();

    const prompt = buildSummaryPrompt(keyholeSow);
    // The document text must appear in the prompt
    expect(prompt).toContain('React Native');
    expect(prompt).toContain('Python/FastAPI');
    expect(prompt).toContain('GCP');
    // The boilerplate warning must come BEFORE the document text
    const boilerplateWarningIdx = prompt.toLowerCase().indexOf('ignore');
    const documentIdx = prompt.indexOf('React Native');
    expect(boilerplateWarningIdx).toBeGreaterThanOrEqual(0);
    expect(boilerplateWarningIdx).toBeLessThan(documentIdx);
  });

  it('includes template context when provided', () => {
    const ctx = 'Technology details are in: "Technical Requirements".';
    const prompt = buildSummaryPrompt('some text', ctx);
    expect(prompt).toContain(ctx);
    expect(prompt).toContain('Document structure guidance');
  });

  it('omits template section when context is empty string', () => {
    const prompt = buildSummaryPrompt('some text', '');
    expect(prompt).not.toContain('Document structure guidance');
  });
});

describe('stripKeyholePreamble', () => {
  const BOILERPLATE = `About Keyhole Software
Core competencies include Java, .NET, JavaScript, as well as cloud technologies such as Azure and AWS.
Keyhole History
Founded in 2008...

`;
  const SOW_CONTENT = `Statement of Work
Client requires a React Native app on GCP.`;

  it('removes the About Keyhole Software section when followed by Statement of Work', () => {
    const doc = `Cover page text.\n\n${BOILERPLATE}${SOW_CONTENT}`;
    const result = stripKeyholePreamble(doc);
    expect(result).not.toContain('About Keyhole Software');
    expect(result).not.toContain('Core competencies');
    expect(result).toContain('Statement of Work');
    expect(result).toContain('React Native');
    expect(result).toContain('Cover page text.');
  });

  it('preserves content before the boilerplate', () => {
    const doc = `Title\nClient: Acme Corp\n\n${BOILERPLATE}${SOW_CONTENT}`;
    const result = stripKeyholePreamble(doc);
    expect(result).toContain('Title');
    expect(result).toContain('Acme Corp');
  });

  it('returns text unchanged when no About Keyhole Software section is present', () => {
    const doc = 'Client wants React on AWS. Budget $2M.';
    expect(stripKeyholePreamble(doc)).toBe(doc);
  });

  it('strips to end-of-string when boilerplate has no Statement of Work following it', () => {
    const doc = `Preamble text.\n\n${BOILERPLATE}`;
    const result = stripKeyholePreamble(doc);
    expect(result).toContain('Preamble text.');
    expect(result).not.toContain('About Keyhole Software');
    expect(result).not.toContain('Core competencies');
  });

  it('is case-insensitive for the section markers', () => {
    const doc = 'about keyhole software\nJava, .NET\n\nstatement of work\nReal content.';
    const result = stripKeyholePreamble(doc);
    expect(result).not.toContain('Java');
    expect(result).toContain('Real content.');
  });
});
