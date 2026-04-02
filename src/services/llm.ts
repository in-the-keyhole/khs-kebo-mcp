import { getLlama, type LlamaChatSession, type LlamaModel as LlamaModelType } from 'node-llama-cpp';
import { config } from '../config.js';
import path from 'path';

interface LlamaModel {
  generate(prompt: string): Promise<string>;
  dispose(): Promise<void>;
}

let _model: LlamaModelType | null = null;
let _session: LlamaChatSession | null = null;

export async function getLlamaModel(): Promise<LlamaModel> {
  if (_model && _session) {
    return {
      generate: (prompt) => _session!.prompt(prompt),
      dispose: async () => {
        await _session?.dispose();
        await _model?.dispose();
        _session = null;
        _model = null;
      },
    };
  }

  const llama = await getLlama();
  _model = await llama.loadModel({
    modelPath: await resolveModelPath(config.LLM_HF_REPO, config.LLM_HF_FILE),
  });

  const ctx = await _model.createContext();
  _session = new (await import('node-llama-cpp')).LlamaChatSession({ contextSequence: ctx.getSequence() });

  return {
    generate: (prompt) => _session!.prompt(prompt),
    dispose: async () => {
      await _session?.dispose();
      await _model?.dispose();
      _session = null;
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
