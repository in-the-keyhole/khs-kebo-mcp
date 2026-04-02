import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),

  // Embedding model — GGUF via HuggingFace
  EMBEDDING_HF_REPO: z.string().default('mixedbread-ai/mxbai-embed-large-v1-GGUF'),
  EMBEDDING_HF_FILE: z.string().default('mxbai-embed-large-v1-f16.gguf'),

  // LLM for redaction + structured summary generation
  LLM_HF_REPO: z.string().default('bartowski/Phi-4-mini-instruct-GGUF'),
  LLM_HF_FILE: z.string().default('Phi-4-mini-instruct-Q4_K_M.gguf'),
});

function loadConfig() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;
