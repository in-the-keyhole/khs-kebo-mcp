import { config } from '../config.js';
import { fetchFileContent, searchDrive } from './drive.js';

// Cached in memory for the lifetime of the process
let _cachedSections: string[] | null = null;

/**
 * Fetch the SOW template from Drive and return its section headings.
 * Result is cached — Drive is only hit once per process lifetime.
 * Returns [] if SCOPE_OF_WORK_TEMPLATE_FILE_ID is not configured or fetch fails.
 */
export async function getSowSections(): Promise<string[]> {
  if (_cachedSections !== null) return _cachedSections;
  if (!config.SCOPE_OF_WORK_TEMPLATE_FILE_ID) {
    _cachedSections = [];
    return [];
  }

  try {
    const file = {
      id: config.SCOPE_OF_WORK_TEMPLATE_FILE_ID,
      name: 'SOW Template',
      mimeType: 'application/vnd.google-apps.document',
    };
    const text = await fetchFileContent(file);
    _cachedSections = parseSowSections(text);
    console.error(`SOW template loaded: ${_cachedSections.length} sections found`);
  } catch (err) {
    console.error(`Warning: could not load SOW template — ${err}. Continuing without it.`);
    _cachedSections = [];
  }

  return _cachedSections;
}

/** Reset cache — used in tests. */
export function resetSowCache(): void {
  _cachedSections = null;
}

/**
 * Extract section headings from exported Google Docs plain text.
 * Handles numbered headings ("1. Project Overview"), title-case lines,
 * and ALL-CAPS headings from Google Docs exports.
 */
export function parseSowSections(text: string): string[] {
  if (!text.trim()) return [];

  const seen = new Set<string>();
  const sections: string[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.length > 80) continue; // skip empty lines and body paragraphs

    // Strip leading numbering: "1.", "1.1.", "A."
    const stripped = line.replace(/^[\d]+\.[\d.]*\s*|^[A-Z]\.\s*/g, '').trim();
    if (!stripped || stripped.length < 3) continue;

    // Match: all-caps line (Google Docs heading export), or Title Case short line
    const isAllCaps = stripped === stripped.toUpperCase() && /[A-Z]/.test(stripped);
    const isTitleCase = /^[A-Z][a-z]/.test(stripped) && stripped.split(' ').length <= 6;

    if (isAllCaps || isTitleCase) {
      // Normalise to title case for consistency
      const normalised = stripped
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      if (!seen.has(normalised)) {
        seen.add(normalised);
        sections.push(normalised);
      }
    }
  }

  return sections;
}

/**
 * Build a prompt fragment telling the LLM which sections contain
 * the information we need. Returns '' if no sections are known.
 */
export function buildTemplateContext(sections: string[]): string {
  if (sections.length === 0) return '';

  // Map known section name patterns to what we're looking for
  const techSections = sections.filter((s) =>
    /tech|solution|architecture|stack|platform|integration|system/i.test(s),
  );
  const budgetSections = sections.filter((s) =>
    /invest|budget|cost|pricing|fee|rate|commercial/i.test(s),
  );
  const scopeSections = sections.filter((s) =>
    /scope|overview|background|objective|goal|deliverable/i.test(s),
  );

  const hints: string[] = [];

  if (techSections.length > 0) {
    hints.push(`Technology details are in: "${techSections.join('", "')}"`);
  }
  if (budgetSections.length > 0) {
    hints.push(`Budget/investment information is in: "${budgetSections.join('", "')}"`);
  }
  if (scopeSections.length > 0) {
    hints.push(`Engagement scope and industry context are in: "${scopeSections.join('", "')}"`);
  }

  if (hints.length === 0) {
    // Fallback: just list all known sections
    return `The document has these sections: ${sections.map((s) => `"${s}"`).join(', ')}.`;
  }

  return `The document follows a standard template. ${hints.join('. ')}.`;
}
