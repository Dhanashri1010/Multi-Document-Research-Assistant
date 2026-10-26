import { config } from '../../config/env.js';
import { ScoredChunk } from './vectorStore.js';

let xenovaClassifier: any = null;

export class RerankerService {
  private static async getClassifier() {
    if (!xenovaClassifier) {
      console.log('[RerankerService] Loading cross-encoder: Xenova/ms-marco-MiniLM-L-6-v2...');
      const { pipeline } = await import('@xenova/transformers');
      xenovaClassifier = await pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2');
      console.log('[RerankerService] Cross-encoder loaded successfully.');
    }
    return xenovaClassifier;
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
      const classifier = await this.getClassifier();
      const scored: ScoredChunk[] = [];

      for (const candidate of candidates) {
        // Truncate candidate text if necessary to fit model max length
        const truncatedText = candidate.chunk.text.slice(0, 512);
        const result = await classifier({
          text: query,
          text_pair: truncatedText,
        });

        // Xenova cross-encoder returns score directly or array of label scores
        let relevanceScore = 0;
        if (Array.isArray(result) && result.length > 0) {
          relevanceScore = result[0].score ?? 0;
        } else if (result?.score !== undefined) {
          relevanceScore = result.score;
        }

        scored.push({
          chunk: candidate.chunk,
          score: relevanceScore,
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
