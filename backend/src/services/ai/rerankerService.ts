import { config } from '../../config/env.js';
import { ScoredChunk } from './vectorStore.js';

let tokenizer: any = null;
let model: any = null;

export class RerankerService {
  private static async getModel() {
    if (!tokenizer || !model) {
      console.log('[RerankerService] Loading cross-encoder: Xenova/ms-marco-MiniLM-L-6-v2...');
      const { AutoTokenizer, AutoModelForSequenceClassification } = await import('@xenova/transformers');
      const modelId = 'Xenova/ms-marco-MiniLM-L-6-v2';
      tokenizer = await AutoTokenizer.from_pretrained(modelId);
      model = await AutoModelForSequenceClassification.from_pretrained(modelId);
      console.log('[RerankerService] Cross-encoder loaded successfully.');
    }
    return { tokenizer, model };
  }

  /**
   * Computes sigmoid to normalize logits into [0, 1].
   */
  private static sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  /**
   * Reranks candidate chunks against a query using a cross-encoder model.
   * If reranker is disabled via config (RERANKER=off), returns candidates unchanged.
   */
  static async rerank(
    query: string,
    candidates: ScoredChunk[],
    topK: number = 6
  ): Promise<ScoredChunk[]> {
    if (config.reranker !== 'on' || candidates.length <= 1) {
      return candidates.slice(0, topK);
    }

    try {
      const { tokenizer: tok, model: mod } = await this.getModel();
      const scored: ScoredChunk[] = [];

      for (const candidate of candidates) {
        // Use passage text (truncated to 512 chars for cross-encoder context limit)
        const passageText = candidate.chunk.text.slice(0, 512);
        const inputs = await tok(query, { text_pair: passageText });
        const output = await mod(inputs);

        // Raw regression logit from cross-encoder
        const rawLogit = output?.logits?.data?.[0] ?? 0;
        const normalizedScore = this.sigmoid(rawLogit);

        scored.push({
          chunk: candidate.chunk,
          score: normalizedScore,
          denseScore: candidate.denseScore,
        });
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    } catch (err) {
      console.warn('[RerankerService] Reranking failed, falling back to original ranking:', err);
      return candidates.slice(0, topK);
    }
  }
}
