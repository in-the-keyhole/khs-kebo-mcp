import { parseSowSections, buildTemplateContext } from '../../src/services/template.js';

describe('parseSowSections', () => {
  it('extracts headings from plain text', () => {
    const text = `
Scope of Work

1. Project Overview
Some overview text here.

2. Technical Requirements
Details about tech.

3. Investment
Budget details here.

4. Timeline
Project schedule.
    `.trim();

    const sections = parseSowSections(text);
    expect(sections).toContain('Project Overview');
    expect(sections).toContain('Technical Requirements');
    expect(sections).toContain('Investment');
    expect(sections).toContain('Timeline');
  });

  it('handles Google Docs exported text with all-caps headings', () => {
    const text = `SCOPE OF WORK\n\nPROJECT OVERVIEW\nText here.\n\nTECHNICAL REQUIREMENTS\nMore text.`;
    const sections = parseSowSections(text);
    expect(sections.length).toBeGreaterThan(0);
  });

  it('deduplicates repeated headings', () => {
    const text = `Project Overview\nText.\n\nProject Overview\nMore text.`;
    const sections = parseSowSections(text);
    const count = sections.filter((s) => s === 'Project Overview').length;
    expect(count).toBe(1);
  });

  it('returns empty array for blank input', () => {
    expect(parseSowSections('')).toEqual([]);
  });
});

describe('buildTemplateContext', () => {
  it('returns empty string when sections is empty', () => {
    expect(buildTemplateContext([])).toBe('');
  });

  it('includes recognised section names in the context string', () => {
    const ctx = buildTemplateContext(['Technical Requirements', 'Investment', 'Timeline']);
    // Technical Requirements → tech hint, Investment → budget hint
    expect(ctx).toContain('Technical Requirements');
    expect(ctx).toContain('Investment');
    // Timeline has no matching category so is not surfaced individually
  });

  it('instructs where to find tech stack and budget information', () => {
    const ctx = buildTemplateContext(['Technical Requirements', 'Investment']);
    // Should guide the LLM toward the right sections
    expect(ctx.toLowerCase()).toMatch(/technical|tech/);
    expect(ctx.toLowerCase()).toMatch(/investment|budget/);
  });
});
