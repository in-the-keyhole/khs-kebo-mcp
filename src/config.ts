import { z } from 'zod';
import { validateHfIdentifier, validateCredentialPath } from './config-validators.js';

const schema = z.object({
  DATABASE_URL: z.string(),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  // Optional: Drive file ID of the SOW template used to structure extraction prompts
  SCOPE_OF_WORK_TEMPLATE_FILE_ID: z.string().optional(),

  // Embedding model — GGUF via HuggingFace
  EMBEDDING_HF_REPO: z.string().default('ChristianAzinn/mxbai-embed-large-v1-gguf'),
  EMBEDDING_HF_FILE: z.string().default('mxbai-embed-large-v1_fp16.gguf'),

  // LLM for redaction + structured summary generation
  LLM_HF_REPO: z.string().default('bartowski/microsoft_Phi-4-mini-instruct-GGUF'),
  LLM_HF_FILE: z.string().default('microsoft_Phi-4-mini-instruct-Q4_K_M.gguf'),
});

function loadConfig() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }

  const cfg = result.data;

  // Validate paths and identifiers to prevent traversal / injection
  validateCredentialPath(cfg.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
  validateHfIdentifier(cfg.EMBEDDING_HF_REPO, 'repo');
  validateHfIdentifier(cfg.EMBEDDING_HF_FILE, 'file');
  validateHfIdentifier(cfg.LLM_HF_REPO, 'repo');
  validateHfIdentifier(cfg.LLM_HF_FILE, 'file');

  return cfg;
}

export const config = loadConfig();
export type Config = typeof config;
