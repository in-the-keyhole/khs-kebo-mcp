import type { LlamaContext } from 'node-llama-cpp';
import type { StructuredSummary, BudgetTier, EngagementType } from '../types.js';

const BUDGET_TIERS: BudgetTier[] = ['startup', 'smb', 'enterprise'];
const ENGAGEMENT_TYPES: EngagementType[] = ['greenfield', 'migration', 'support', 'augmentation'];

const ENGAGEMENT_ALIASES: Record<string, EngagementType> = {
  'staff augmentation': 'augmentation',
  'augment': 'augmentation',
  'new build': 'greenfield',
  'new project': 'greenfield',
  'modernization': 'migration',
  'modernisation': 'migration',
  'replatform': 'migration',
  'replatforming': 'migration',
  'maintenance': 'support',
  'managed services': 'support',
};

export function buildSummaryPrompt(documentText: string, templateContext = ''): string {
  const templateHint = templateContext
    ? `\n\nDocument structure guidance:\n${templateContext}`
    : '';

  return `You are an analyst extracting anonymized metadata from a client engagement document (a Statement of Work or proposal).
Do not identify the client by name or reference any individual's name.

IMPORTANT: This document contains boilerplate sections about the consulting firm's own capabilities (e.g. "About Keyhole Software", "Core competencies include Java, .NET..."). IGNORE these sections entirely. Extract only technologies, cloud providers, and details that are specific to THIS CLIENT'S project requirements and deliverables.${templateHint}

Return ONLY a JSON object with these exact fields (no markdown, no explanation):
{
  "industry": "<single lowercase industry label, e.g. fintech, healthcare, logistics, retail, manufacturing, saas, govtech>",
  "tech_stack": ["<programming languages, frameworks, databases, and platforms the CLIENT requires — e.g. React, Java, PostgreSQL, Kubernetes. DO NOT include app distribution platforms (Google Play, App Store), analytics tools (Google Analytics), or generic consulting deliverables>"],
  "budget_tier": "<one of: startup, smb, enterprise>",
  "cloud_providers": ["<cloud infrastructure providers only: AWS | Azure | GCP | on-premise | none. DO NOT include app stores or analytics platforms>"],
  "engagement_type": "<one of: greenfield, migration, support, augmentation>"
}

Budget tier guidance — look at the "Estimated Schedule and Charges" or "Investment" section for the total dollar amount:
- startup: total engagement value under $500K (e.g. $50K–$499K)
- smb: total engagement value $500K–$5M
- enterprise: total engagement value over $5M, OR explicitly described as Fortune-500 / large enterprise
DO NOT infer budget from technical complexity. Use the stated dollar amount if present.

Document to analyse:
---
${documentText}
---

JSON:`;
}

export function parseSummaryJson(raw: string): StructuredSummary {
  // Strip markdown code fences if present
  const stripped = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();

  let parsed: unknown;
  try {
    // Try to extract JSON object even if there's surrounding text
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found');
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error(`Could not parse summary JSON from LLM output: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Parsed value is not an object');
  }

  const obj = parsed as Record<string, unknown>;
  const required = ['industry', 'tech_stack', 'budget_tier', 'cloud_providers', 'engagement_type'];
  for (const field of required) {
    if (!(field in obj)) throw new Error(`Missing required field: ${field}`);
  }

  const budget_tier = normaliseBudgetTier(String(obj.budget_tier));
  const engagement_type = normaliseEngagementType(String(obj.engagement_type));

  return {
    industry: String(obj.industry).toLowerCase().trim(),
    tech_stack: toStringArray(obj.tech_stack),
    budget_tier,
    cloud_providers: toStringArray(obj.cloud_providers),
    engagement_type,
  };
}

function normaliseBudgetTier(raw: string): BudgetTier {
  const lower = raw.toLowerCase().trim();
  if ((BUDGET_TIERS as string[]).includes(lower)) return lower as BudgetTier;
  // Fuzzy fallback
  if (lower.includes('enterprise') || lower.includes('large')) return 'enterprise';
  if (lower.includes('startup') || lower.includes('seed')) return 'startup';
  return 'smb';
}

function normaliseEngagementType(raw: string): EngagementType {
  const lower = raw.toLowerCase().trim();
  if ((ENGAGEMENT_TYPES as string[]).includes(lower)) return lower as EngagementType;
  for (const [alias, canonical] of Object.entries(ENGAGEMENT_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  return 'support'; // safe default
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((v) => String(v));
  if (typeof val === 'string') return [val];
  return [];
}

/**
 * Generate a structured summary from document text using a local LLM.
 * The context must be from a loaded LlamaModel chat session.
 */
const LLM_MAX_CHARS = 50_000;

/**
 * Truncate document text before sending to the LLM.
 * Prevents runaway token consumption and limits prompt injection surface.
 */
const TRUNCATION_SUFFIX = '\n[truncated]';

export function truncateForLlm(text: string, limit = LLM_MAX_CHARS): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
}

/**
 * Strip the "About Keyhole Software" boilerplate section that appears near the
 * top of every SOW before the actual Statement of Work content.  Without this,
 * Phi-4-mini (and similar small models) extract Keyhole's own tech stack
 * (Java, .NET, JavaScript, Azure, AWS) instead of the client's.
 *
 * Removes text from "About Keyhole Software" up to (but not including) the
 * next section header — typically "Statement of Work".  Falls back to
 * stripping to end-of-string if no end marker is found.
 */
export function stripKeyholePreamble(text: string): string {
  const startIdx = text.search(/\bAbout Keyhole Software\b/i);
  if (startIdx === -1) return text;

  const after = text.slice(startIdx);
  const endIdx = after.search(/\bStatement of Work\b/i);

  if (endIdx === -1) return text.slice(0, startIdx);
  return text.slice(0, startIdx) + text.slice(startIdx + endIdx);
}

export async function generateSummary(
  text: string,
  generateFn: (prompt: string) => Promise<string>,
  templateContext = '',
): Promise<StructuredSummary> {
  const prompt = buildSummaryPrompt(truncateForLlm(stripKeyholePreamble(text)), templateContext);
  const raw = await generateFn(prompt);
  return parseSummaryJson(raw);
}
