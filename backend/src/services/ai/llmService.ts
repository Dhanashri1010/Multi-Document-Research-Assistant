import { config } from '../../config/env.js';

export interface LLMGenerateOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

function isRetryableError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode || err.response?.status;
  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
    return true;
  }
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('unavailable') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  maxRetries: number
): Promise<T> {
  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    let timer: NodeJS.Timeout | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`LLM call timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const result = await Promise.race([fn(), timeoutPromise]);
      if (timer) clearTimeout(timer);
      return result;
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      lastError = err;

      if (attempt < maxRetries && isRetryableError(err)) {
        const delay = Math.min(500 * Math.pow(2, attempt), 4000) + Math.floor(Math.random() * 100);
        console.warn(`[LLMService] Retryable error encountered (attempt ${attempt + 1}/${maxRetries}): ${err.message}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
      } else {
        throw lastError;
      }
    }
  }

  throw lastError;
}

export class LLMService {
  /**
   * Generates a grounded completion using the configured LLM provider.
   */
  static async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<string> {
    const provider = config.llmProvider;
    const apiKey = config.llmApiKey;
    const model = config.llmModel;
    const timeoutMs = options.timeoutMs ?? config.llmTimeoutMs;
    const maxRetries = options.maxRetries ?? config.llmMaxRetries;

    // Deterministic Mock Provider for offline tests or mock configuration
    if (provider === 'mock') {
      return this.generateMock(prompt, options);
    }

    // Check if API key is required and missing
    if ((provider === 'gemini' || provider === 'openai') && !apiKey) {
      throw new Error(
        `LLM provider "${provider}" requires an API key, but LLM_API_KEY is not set in backend/.env. ` +
        `Please set LLM_API_KEY=your_key in backend/.env to generate generative responses.`
      );
    }

    return withRetry(
      async () => {
        if (provider === 'gemini') {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey });

          // Normalize retired or legacy Gemini model names to active Google GenAI models
          let targetModel = (model || '').trim();
          if (
            !targetModel ||
            targetModel.startsWith('gemini-1.') ||
            targetModel.startsWith('gemini-2.') ||
            targetModel === 'gemini-pro'
          ) {
            targetModel = 'gemini-3.5-flash-lite';
          }

          try {
            const response = await ai.models.generateContent({
              model: targetModel,
              contents: prompt,
              config: {
                systemInstruction: options.systemPrompt,
                temperature: options.temperature ?? 0.2,
                maxOutputTokens: options.maxTokens ?? 2048,
              },
            });

            return response.text || '';
          } catch (modelErr: any) {
            // If the model is retired, not found, or experiencing temporary issues, try fallback to gemini-3.8-flash
            if (
              modelErr?.status === 404 ||
              modelErr?.message?.includes('not found') ||
              modelErr?.message?.includes('no longer available') ||
              modelErr?.message?.includes('high demand')
            ) {
              const fallbackModel = targetModel === 'gemini-3.5-flash-lite' ? 'gemini-3.8-flash' : 'gemini-3.5-flash-lite';
              console.warn(
                `[LLMService] Model "${targetModel}" is unavailable on Gemini API. Retrying with fallback "${fallbackModel}"...`
              );
              const fallbackRes = await ai.models.generateContent({
                model: fallbackModel,
                contents: prompt,
                config: {
                  systemInstruction: options.systemPrompt,
                  temperature: options.temperature ?? 0.2,
                  maxOutputTokens: options.maxTokens ?? 2048,
                },
              });
              return fallbackRes.text || '';
            }
            throw modelErr;
          }
        }

        if (provider === 'openai') {
          const OpenAI = (await import('openai')).default;
          const client = new OpenAI({ apiKey, timeout: timeoutMs });
          const messages: any[] = [];

          if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
          }
          messages.push({ role: 'user', content: prompt });

          const completion = await client.chat.completions.create({
            model: model || 'gpt-4o-mini',
            messages,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 2048,
          });

          return completion.choices[0]?.message?.content || '';
        }

        if (provider === 'ollama') {
          const response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: model || 'llama3',
              prompt: options.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt,
              stream: false,
              options: {
                temperature: options.temperature ?? 0.2,
              },
            }),
          });

          if (!response.ok) {
            throw new Error(`Ollama request failed with status ${response.status}: ${response.statusText}`);
          }

          const data = (await response.json()) as any;
          return data.response;
        }

        throw new Error(`Unsupported LLM provider: ${provider}`);
      },
      timeoutMs,
      maxRetries
    );
  }

  /**
   * Deterministic mock generator used for offline testing and verification.
   */
  private static generateMock(prompt: string, _options: LLMGenerateOptions): string {
    const p = prompt.toLowerCase();

    // Summary schema requested
    if (p.includes('summary of the paper') || p.includes('generate the json summary now')) {
      return JSON.stringify({
        summary: 'This paper presents an evidence-backed approach to neural modeling and efficient transformer adaptation with empirical validation across standard benchmarks.',
        keyFindings: [
          'Attention mechanisms replace recurrence with superior computational parallelization.',
          'Parameter-efficient low-rank adaptation reduces trainable weights by over 90% without quality degradation.',
        ],
        methodology: 'Evaluated using standardized translation (WMT 2014) and language model fine-tuning suites (GLUE benchmark).',
        limitations: 'Context window limits sequence lengths and matrix rank hyperparameter requires tuning per task.',
      });
    }

    // Comparison matrix schema requested
    if (p.includes('8 academic dimensions') || p.includes('generate the json comparison now')) {
      return JSON.stringify({
        matrix: [
          {
            dimension: 'Research Objective',
            values: [
              { documentId: 'mock1', documentName: 'Paper 1', finding: 'Eliminate recurrence using attention.', pageNumber: 1 },
              { documentId: 'mock2', documentName: 'Paper 2', finding: 'Parameter-efficient fine-tuning via low-rank decomposition.', pageNumber: 1 },
            ],
          },
          {
            dimension: 'Methodology',
            values: [
              { documentId: 'mock1', documentName: 'Paper 1', finding: 'Multi-Head Attention and Positional Encodings.', pageNumber: 2 },
              { documentId: 'mock2', documentName: 'Paper 2', finding: 'Freeze pre-trained weights and inject trainable low-rank matrices.', pageNumber: 2 },
            ],
          },
        ],
        similarities: [
          'Both papers target improvements to large-scale transformer architectures.',
          'Both maintain competitive evaluation metrics while improving computational efficiency.',
        ],
        differences: [
          'Paper 1 proposes a novel foundational architecture, whereas Paper 2 proposes an adaptation strategy for pre-trained models.',
        ],
        keyFindings: [
          'Transformer achieves new state-of-the-art BLEU scores.',
          'LoRA matches or outperforms full fine-tuning with 10,000x fewer parameters.',
        ],
        limitations: [
          'Transformer quadratic attention complexity on very long sequences.',
          'LoRA introduces rank hyperparameter tuning trade-offs.',
        ],
      });
    }

    // Default RAG Q&A answer
    return `Based on the provided research documents, the Transformer architecture replaces recurrence with multi-head self-attention, enabling greater training parallelization. Furthermore, low-rank adaptation demonstrates that weight updates during downstream adaptation have a low intrinsic dimension.`;
  }
}
