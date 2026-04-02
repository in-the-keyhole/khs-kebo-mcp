// Minimal env vars for unit tests — no real services needed
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/kebo_mcp_test';
process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ??= './credentials/service-account.json';
process.env.EMBEDDING_HF_REPO ??= 'mixedbread-ai/mxbai-embed-large-v1-GGUF';
process.env.EMBEDDING_HF_FILE ??= 'mxbai-embed-large-v1-f16.gguf';
process.env.LLM_HF_REPO ??= 'bartowski/Phi-4-mini-instruct-GGUF';
process.env.LLM_HF_FILE ??= 'Phi-4-mini-instruct-Q4_K_M.gguf';
