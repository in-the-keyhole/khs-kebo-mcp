/**
 * Regex-based PII redaction pass.
 * Strips patterns that would reveal exact client financials or contact info.
 * The LLM summarizer handles the nuanced redaction (client names, org names).
 */

const PATTERNS: Array<[RegExp, string]> = [
  // Dollar amounts: $1,234 | $1.2M | $500K | $50000
  [/\$[\d,]+(?:\.\d+)?[KMBkmb]?\b/g, '[AMOUNT]'],
  // Email addresses
  [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]'],
  // US phone numbers: (555) 867-5309 | 555-867-5309 | 555.867.5309
  [/(?:\(?\d{3}\)?[\s.\-])?\d{3}[\s.\-]\d{4}/g, '[PHONE]'],
];

export function redactRegex(text: string): string {
  return PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}
