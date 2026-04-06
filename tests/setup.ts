/// <reference types="node" />
// Minimal env vars for unit tests — no real services needed
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/kebo_mcp_test';
process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ??= './credentials/service-account.json';
process.env.EMBEDDING_HF_REPO ??= 'ChristianAzinn/mxbai-embed-large-v1-gguf';
process.env.EMBEDDING_HF_FILE ??= 'mxbai-embed-large-v1_fp16.gguf';
process.env.LLM_HF_REPO ??= 'bartowski/microsoft_Phi-4-mini-instruct-GGUF';
process.env.LLM_HF_FILE ??= 'microsoft_Phi-4-mini-instruct-Q4_K_M.gguf';
// HF_TOKEN intentionally omitted — models used are public and don't require auth
