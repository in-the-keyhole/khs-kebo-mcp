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

  return `You are an analyst extracting anonymized metadata from a client engagement document.
Do not identify the client by name or reference any individual's name.
Focus only on: what industry they are in, what technologies they use, their budget scale, cloud infrastructure, and the type of engagement.${templateHint}

Return ONLY a JSON object with these exact fields (no markdown, no explanation):
{
  "industry": "<single lowercase industry label, e.g. fintech, healthcare, logistics, retail, manufacturing, saas, govtech>",
  "tech_stack": ["<technology names as used in the doc>"],
  "budget_tier": "<one of: startup, smb, enterprise>",
  "cloud_providers": ["<AWS | Azure | GCP | on-premise | none>"],
  "engagement_type": "<one of: greenfield, migration, support, augmentation>"
}

Budget tier guidance:
- startup: early-stage, small budgets, typically under $500K total engagement value
- smb: small-to-mid business, $500K–$5M range
- enterprise: large organisations, over $5M or Fortune-500 type

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

export async function generateSummary(
  text: string,
  generateFn: (prompt: string) => Promise<string>,
  templateContext = '',
): Promise<StructuredSummary> {
  const prompt = buildSummaryPrompt(truncateForLlm(text), templateContext);
  const raw = await generateFn(prompt);
  return parseSummaryJson(raw);
}
