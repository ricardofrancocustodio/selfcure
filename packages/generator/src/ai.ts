// ---------------------------------------------------------------------------
// Provider resolution layer (BYOK — Bring Your Own Key)
//
// Translates an AIConfig from selfcure.config.mjs into a Vercel AI SDK
// LanguageModel that @selfcure/generator and @selfcure/selfcure can pass to
// `generateText`. Adding a new provider is a single switch arm + a row in
// PROVIDERS metadata.
// ---------------------------------------------------------------------------

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'groq'
  | 'deepseek'
  | 'ollama';

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** Env var that holds the API key (null = no key required, e.g. Ollama) */
  envVar: string | null;
  defaultGenerationModel: string;
  defaultHealingModel: string;
  /** Default base URL — only present for providers behind a configurable endpoint */
  defaultBaseURL?: string;
  /** Short hint shown in the wizard */
  hint: string;
  apiKeyPlaceholder: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    defaultGenerationModel: 'claude-opus-4-7',
    defaultHealingModel: 'claude-haiku-4-5',
    hint: 'Top-tier reasoning, $$$',
    apiKeyPlaceholder: 'sk-ant-…',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    defaultGenerationModel: 'gpt-4.1',
    defaultHealingModel: 'gpt-4o-mini',
    hint: 'Most widely available',
    apiKeyPlaceholder: 'sk-…',
  },
  google: {
    id: 'google',
    label: 'Google Gemini',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    defaultGenerationModel: 'gemini-2.0-flash-exp',
    defaultHealingModel: 'gemini-2.0-flash-exp',
    hint: 'Generous free tier',
    apiKeyPlaceholder: 'AIza…',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    envVar: 'GROQ_API_KEY',
    defaultGenerationModel: 'llama-3.3-70b-versatile',
    defaultHealingModel: 'llama-3.1-8b-instant',
    hint: 'Free tier, fastest inference',
    apiKeyPlaceholder: 'gsk_…',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    defaultGenerationModel: 'deepseek-chat',
    defaultHealingModel: 'deepseek-chat',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    hint: 'Ultra-cheap, OpenAI-compatible',
    apiKeyPlaceholder: 'sk-…',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    envVar: null,
    defaultGenerationModel: 'qwen2.5-coder:14b',
    defaultHealingModel: 'qwen2.5-coder:7b',
    defaultBaseURL: 'http://localhost:11434/v1',
    hint: 'No key, runs locally',
    apiKeyPlaceholder: '',
  },
};

export interface AIConfig {
  provider: ProviderId;
  generationModel?: string;
  healingModel?: string;
  /** Override the env var name (default: PROVIDERS[provider].envVar) */
  apiKeyEnv?: string;
  /** Override the base URL (used by Ollama / DeepSeek / self-hosted endpoints) */
  baseURL?: string;
}

export type ModelKind = 'generation' | 'healing';

function pickModelName(ai: AIConfig, kind: ModelKind): string {
  const meta = PROVIDERS[ai.provider];
  if (kind === 'generation') return ai.generationModel ?? meta.defaultGenerationModel;
  return ai.healingModel ?? meta.defaultHealingModel;
}

function readApiKey(ai: AIConfig): string | undefined {
  const envName = ai.apiKeyEnv ?? PROVIDERS[ai.provider].envVar;
  if (!envName) return undefined;
  return process.env[envName];
}

/**
 * Build a Vercel AI SDK LanguageModel for the given config + role.
 * Throws if the provider requires an API key and the env var is missing.
 */
export function getModel(ai: AIConfig, kind: ModelKind): LanguageModel {
  const meta = PROVIDERS[ai.provider];
  const modelName = pickModelName(ai, kind);
  const apiKey = readApiKey(ai);

  if (meta.envVar && !apiKey) {
    throw new Error(
      `Missing ${meta.envVar} for provider "${ai.provider}". ` +
      `Set it in your .env or shell environment.`,
    );
  }

  switch (ai.provider) {
    case 'anthropic': {
      const client = createAnthropic({ apiKey });
      return client(modelName);
    }
    case 'openai': {
      const client = createOpenAI({ apiKey });
      return client(modelName);
    }
    case 'google': {
      const client = createGoogleGenerativeAI({ apiKey });
      return client(modelName);
    }
    case 'groq': {
      const client = createGroq({ apiKey });
      return client(modelName);
    }
    case 'deepseek': {
      const client = createOpenAICompatible({
        name: 'deepseek',
        baseURL: ai.baseURL ?? meta.defaultBaseURL!,
        apiKey,
      });
      return client(modelName);
    }
    case 'ollama': {
      const client = createOpenAICompatible({
        name: 'ollama',
        baseURL: ai.baseURL ?? meta.defaultBaseURL!,
      });
      return client(modelName);
    }
  }
}
