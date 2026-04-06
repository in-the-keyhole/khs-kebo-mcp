import { getLlama, LlamaLogLevel, type LlamaChatSession, type LlamaModel as LlamaModelType, type LlamaContext } from 'node-llama-cpp';
import { config } from '../config.js';
import path from 'path';

interface LlamaModel {
  generate(prompt: string): Promise<string>;
  dispose(): Promise<void>;
}

// Keep the loaded model singleton — expensive to reload
// But create a fresh context+session per generate() call to avoid
// chat history contaminating subsequent documents
let _model: LlamaModelType | null = null;

export async function getLlamaModel(): Promise<LlamaModel> {
  if (!_model) {
    const llama = await getLlama({ logLevel: LlamaLogLevel.disabled });
    _model = await llama.loadModel({
      modelPath: await resolveModelPath(config.LLM_HF_REPO, config.LLM_HF_FILE),
    });
  }

  return {
    generate: async (prompt) => {
      // Fresh context + session for each call — prevents chat history bleed
      const { LlamaChatSession } = await import('node-llama-cpp');
      const ctx: LlamaContext = await _model!.createContext();
      const session: LlamaChatSession = new LlamaChatSession({ contextSequence: ctx.getSequence() });
      try {
        return await session.prompt(prompt);
      } finally {
        await session.dispose();
        await ctx.dispose();
      }
    },
    dispose: async () => {
      await _model?.dispose();
      _model = null;
    },
  };
}

async function resolveModelPath(repo: string, filename: string): Promise<string> {
  const { createModelDownloader } = await import('node-llama-cpp');

  const downloader = await createModelDownloader({
    modelUri: `hf:${repo}/${filename}`,
    dirPath: path.join(process.cwd(), 'models'),
  });

  if (downloader.totalFiles > 0) {
    console.error(`Downloading LLM ${repo}/${filename}...`);
    await downloader.download();
    console.error('LLM download complete.');
  }

  return downloader.entrypointFilePath;
}
