import { DocumentChunkModel, IDocumentChunk } from '../../models/DocumentChunk.js';
import { Types } from 'mongoose';
import { config } from '../../config/env.js';
import { BM25Index, BM25Document } from './bm25.js';
import { RerankerService } from './rerankerService.js';

export interface ScoredChunk {
  chunk: IDocumentChunk;
  score: number;
  denseScore?: number;
  bm25Score?: number;
}

export interface CachedChunk {
  chunk: IDocumentChunk;
  embeddingVector: Float32Array;
}

export interface VectorSearchOptions {
  topK?: number;
  minScore?: number;
  queryText?: string;
  hybridWeight?: number;
}

/**
 * Universal interface for vector store retrieval implementations (Local and Atlas).
 */
export interface IVectorStore {
  search(
    queryEmbedding: number[],
    documentIds: Types.ObjectId[] | string[],
    options?: VectorSearchOptions
  ): Promise<ScoredChunk[]>;
}

// In-memory typed vector cache: docId -> array of CachedChunk
const vectorCache = new Map<string, CachedChunk[]>();

/**
 * Invalidate vector cache for a specific document or entire cache.
 */
export function invalidateVectorCache(docId?: string): void {
  if (docId) {
    vectorCache.delete(docId.toString());
  } else {
    vectorCache.clear();
  }
}

/**
 * Fast cosine similarity for raw number arrays.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * High-performance cosine similarity for typed Float32Array vectors.
 */
export function cosineSimilarityTyped(vecA: Float32Array, vecB: Float32Array): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Maximal Marginal Relevance (MMR) for result diversity and deduplication.
 * @param candidates Candidates with typed Float32Array vectors and relevance scores
 * @param topK Number of diverse items to select
 * @param lambda Tradeoff between query relevance and diversity (0.7 recommended)
 */
export function maximalMarginalRelevance(
  candidates: { chunk: IDocumentChunk; vector: Float32Array; score: number; denseScore: number }[],
  topK: number,
  lambda: number = 0.7
): ScoredChunk[] {
  if (candidates.length <= topK) {
    return candidates.map((c) => ({
      chunk: c.chunk,
      score: c.score,
      denseScore: c.denseScore,
    }));
  }

  const selected: { chunk: IDocumentChunk; vector: Float32Array; score: number; denseScore: number }[] = [];
  const remaining = [...candidates].sort((a, b) => b.score - a.score);

  // First pick is the highest scoring candidate
  const first = remaining.shift()!;
  selected.push(first);

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = -1;
    let bestMmrScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevance = candidate.score;

      // Find max similarity between candidate and already selected items
      let maxSim = 0;
      for (const sel of selected) {
        const sim = cosineSimilarityTyped(candidate.vector, sel.vector);
        if (sim > maxSim) {
          maxSim = sim;
        }
      }

      // Strong deduplication penalty for near-identical chunks (>0.98 similarity)
      const diversityPenalty = maxSim > 0.98 ? 1.0 : maxSim;
      const mmrScore = lambda * relevance - (1 - lambda) * diversityPenalty;

      if (mmrScore > bestMmrScore) {
        bestMmrScore = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      selected.push(remaining.splice(bestIdx, 1)[0]);
    } else {
      break;
    }
  }

  return selected.map((s) => ({
    chunk: s.chunk,
    score: s.score,
    denseScore: s.denseScore,
  }));
}

/**
 * Local in-memory typed vector store with BM25 + Dense RRF hybrid search,
 * MMR diversity filtering, embedding model mismatch enforcement, and per-document quota.
 */
export class LocalVectorStore implements IVectorStore {
  /**
   * Fetches chunks for specified documents, utilizing in-memory typed Float32Array cache.
   */
  private async getCachedChunksForDocs(docIds: string[]): Promise<Map<string, CachedChunk[]>> {
    const result = new Map<string, CachedChunk[]>();
    const missingDocIds: string[] = [];

    for (const id of docIds) {
      const cached = vectorCache.get(id);
      if (cached && cached.length > 0) {
        result.set(id, cached);
      } else {
        missingDocIds.push(id);
      }
    }

    if (missingDocIds.length > 0) {
      const objectIds = missingDocIds.map((id) => new Types.ObjectId(id));
      const chunks = await DocumentChunkModel.find({
        documentId: { $in: objectIds },
      }).lean();

      const grouped = new Map<string, CachedChunk[]>();
      for (const chunk of chunks) {
        const docIdStr = chunk.documentId.toString();
        if (!grouped.has(docIdStr)) {
          grouped.set(docIdStr, []);
        }

        if (chunk.embedding && chunk.embedding.length > 0) {
          grouped.get(docIdStr)!.push({
            chunk: chunk as unknown as IDocumentChunk,
            embeddingVector: new Float32Array(chunk.embedding),
          });
        }
      }

      for (const id of missingDocIds) {
        const docChunks = grouped.get(id) || [];
        vectorCache.set(id, docChunks);
        result.set(id, docChunks);
      }
    }

    return result;
  }

  /**
   * Hybrid search across specified documents:
   * 1. Dense Cosine Similarity (Float32Array) with Model & Dimension Mismatch Enforcement
   * 2. BM25 Lexical Ranking across the candidate corpus
   * 3. Reciprocal Rank Fusion (RRF, k=60) with dense tiebreaking
   * 4. Multi-document proportional quota allocation (prevent single-paper domination)
   * 5. References section exclusion (unless query asks for references/citations)
   * 6. Maximal Marginal Relevance (MMR, lambda=0.7) for cross-chunk diversity
   * 7. Cross-encoder reranking (retrieve top 20-30, rerank to top 5-6 with no-op fallback)
   */
  async search(
    queryEmbedding: number[],
    documentIds: Types.ObjectId[] | string[],
    options: VectorSearchOptions = {}
  ): Promise<ScoredChunk[]> {
    const topK = options.topK || 6;
    const minScore = options.minScore || 0.22;
    const queryText = options.queryText || '';

    const docIdStrings = documentIds.map((id) => id.toString());
    if (docIdStrings.length === 0) return [];

    const queryVecTyped = new Float32Array(queryEmbedding);
    const queryMentionsReferences = /\b(references?|citations?|bibliography)\b/i.test(queryText);
    const activeModel = config.embeddingModel;

    // 1. Fetch chunks using in-memory Float32Array cache
    const docChunksMap = await this.getCachedChunksForDocs(docIdStrings);
    const numDocs = docIdStrings.length;

    const validChunks: CachedChunk[] = [];
    const mismatchedDocIds = new Set<string>();

    for (const docId of docIdStrings) {
      const docChunks = docChunksMap.get(docId) || [];
      for (const item of docChunks) {
        // Enforce embedding dimension match
        if (item.embeddingVector.length !== queryVecTyped.length) {
          mismatchedDocIds.add(docId);
          continue;
        }

        // Refuse to mix models: verify chunk model matches active embedding model if specified
        if (item.chunk.embeddingModel && item.chunk.embeddingModel !== activeModel) {
          mismatchedDocIds.add(docId);
          continue;
        }

        // Section filter: skip bibliography/references unless requested
        if (!queryMentionsReferences && item.chunk.section === 'References') {
          continue;
        }

        validChunks.push(item);
      }
    }

    if (mismatchedDocIds.size > 0) {
      console.warn(
        `[VectorStore] Warning: ${mismatchedDocIds.size} document(s) need re-indexing because their vector dimensions or embedding model differ from the active query embedding (${activeModel}, ${queryVecTyped.length}-dim). Run POST /api/documents/reindex-all or npm run reindex to update.`
      );
    }

    if (validChunks.length === 0) {
      return [];
    }

    // 2. Compute Global Dense Similarities
    const denseRankMap = new Map<string, { rank: number; sim: number }>();
    const denseScored = validChunks.map((item) => ({
      item,
      sim: cosineSimilarityTyped(queryVecTyped, item.embeddingVector),
    }));
    denseScored.sort((a, b) => b.sim - a.sim);
    denseScored.forEach((entry, idx) => {
      denseRankMap.set(entry.item.chunk._id.toString(), { rank: idx + 1, sim: entry.sim });
    });

    // 3. Compute Global BM25 Scores across all candidate chunks
    const bm25RankMap = new Map<string, { rank: number; score: number }>();
    if (queryText.trim().length > 0) {
      const bm25Docs: BM25Document[] = validChunks.map((c) => ({
        id: c.chunk._id.toString(),
        text: c.chunk.text,
      }));
      const bm25Index = new BM25Index(bm25Docs);
      const bm25Results = bm25Index.search(queryText);
      bm25Results.forEach((res, idx) => {
        bm25RankMap.set(res.id, { rank: idx + 1, score: res.score });
      });
    }

    // 4. Compute Reciprocal Rank Fusion (RRF, k=60) with dense similarity tiebreaker
    const RRF_K = 60;
    const allFusedCandidates: {
      chunk: IDocumentChunk;
      vector: Float32Array;
      score: number;
      denseScore: number;
    }[] = [];

    for (const item of validChunks) {
      const idStr = item.chunk._id.toString();
      const denseInfo = denseRankMap.get(idStr);
      if (!denseInfo) continue;

      const denseRank = denseInfo.rank;
      const bm25Info = bm25RankMap.get(idStr);
      const bm25Rank = bm25Info ? bm25Info.rank : 999;

      // Base RRF score + subtle dense score tiebreaker
      const rrfScore =
        1.0 / (RRF_K + denseRank) +
        (bm25Info ? 1.0 / (RRF_K + bm25Rank) : 0) +
        0.0001 * denseInfo.sim;

      if (denseInfo.sim >= minScore || (bm25Info && bm25Info.score > 1.5)) {
        allFusedCandidates.push({
          chunk: item.chunk,
          vector: item.embeddingVector,
          score: rrfScore,
          denseScore: denseInfo.sim,
        });
      }
    }

    if (allFusedCandidates.length === 0) {
      return [];
    }

    allFusedCandidates.sort((a, b) => b.score - a.score);

    // 5. Apply Balanced Multi-Document Quota Allocation
    // Ensures one paper cannot dominate multi-document synthesis by balancing candidates across documents
    const docGrouped = new Map<string, typeof allFusedCandidates>();
    for (const cand of allFusedCandidates) {
      const dId = cand.chunk.documentId.toString();
      if (!docGrouped.has(dId)) {
        docGrouped.set(dId, []);
      }
      docGrouped.get(dId)!.push(cand);
    }

    // Helper: balance candidates across documents so no single paper dominates
    const balanceCandidates = (targetK: number): typeof allFusedCandidates => {
      if (numDocs <= 1) {
        return allFusedCandidates;
      }

      const basePerDoc = Math.max(1, Math.floor(targetK / numDocs));
      const selected: typeof allFusedCandidates = [];
      const selectedIds = new Set<string>();
      const remainingByDoc = new Map<string, typeof allFusedCandidates>();

      // Pass 1: Guarantee proportional representation from each document with matching evidence
      for (const [docId, cands] of docGrouped.entries()) {
        cands.sort((a, b) => b.score - a.score);
        const docDiverse = maximalMarginalRelevance(cands, basePerDoc, 0.7);
        for (const d of docDiverse) {
          const match = cands.find((c) => c.chunk._id.toString() === d.chunk._id.toString());
          if (match && !selectedIds.has(match.chunk._id.toString())) {
            selected.push(match);
            selectedIds.add(match.chunk._id.toString());
          }
        }
        const remaining = cands.filter((c) => !selectedIds.has(c.chunk._id.toString()));
        remainingByDoc.set(docId, remaining);
      }

      // Pass 2: Fill remaining slots up to targetK from highest-scoring remaining candidates
      if (selected.length < targetK) {
        const leftovers = Array.from(remainingByDoc.values()).flat();
        leftovers.sort((a, b) => b.score - a.score);
        for (const cand of leftovers) {
          if (selected.length >= targetK) break;
          if (!selectedIds.has(cand.chunk._id.toString())) {
            selected.push(cand);
            selectedIds.add(cand.chunk._id.toString());
          }
        }
      }

      return selected;
    };

    // 6. Candidate Pool Sizing & Reranking Step
    // When reranker is ON: retrieve top 20-30 balanced candidates, rerank to top 5-6
    // When reranker is OFF: no-op fallback, return document-balanced MMR candidates
    const isRerankerActive = config.reranker === 'on' && queryText.trim().length > 0;

    if (isRerankerActive) {
      // Retrieve top 20-30 candidate pool balanced across documents
      const candidatePoolSize = Math.min(allFusedCandidates.length, Math.max(topK * 4, 25));
      const balancedPool = balanceCandidates(candidatePoolSize);
      const mmrPool = maximalMarginalRelevance(balancedPool, candidatePoolSize, 0.7);

      // Cross-encoder rerank down to requested topK
      return await RerankerService.rerank(queryText, mmrPool, topK);
    }

    // Standard path (reranker off / default): balanced document selection
    if (numDocs > 1) {
      const balancedResults = balanceCandidates(topK);
      return balancedResults.map((b) => ({
        chunk: b.chunk,
        score: b.score,
        denseScore: b.denseScore,
      }));
    }

    const mmrResults = maximalMarginalRelevance(allFusedCandidates, topK, 0.7);
    return mmrResults.slice(0, topK);
  }
}

/**
 * MongoDB Atlas Vector Search implementation with graceful fallback to LocalVectorStore.
 */
export class AtlasVectorStore implements IVectorStore {
  private localFallback = new LocalVectorStore();

  async search(
    queryEmbedding: number[],
    documentIds: Types.ObjectId[] | string[],
    options: VectorSearchOptions = {}
  ): Promise<ScoredChunk[]> {
    const topK = options.topK || 6;
    const docIdStrings = documentIds.map((id) => id.toString());
    if (docIdStrings.length === 0) return [];

    try {
      const objectIds = docIdStrings.map((id) => new Types.ObjectId(id));
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: config.vectorIndexName,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: topK * 10,
            limit: topK,
            filter: {
              documentId: { $in: objectIds },
            },
          },
        },
        {
          $project: {
            documentId: 1,
            chunkIndex: 1,
            text: 1,
            pageNumber: 1,
            pageStart: 1,
            pageEnd: 1,
            section: 1,
            tokenCount: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];

      const atlasResults = await DocumentChunkModel.aggregate(pipeline);
      if (atlasResults && atlasResults.length > 0) {
        return atlasResults.map((doc: any) => ({
          chunk: doc as IDocumentChunk,
          score: doc.score || 0,
          denseScore: doc.score || 0,
        }));
      }
    } catch (atlasErr) {
      console.warn('[AtlasVectorStore] Atlas vector search failed, falling back to local engine:', atlasErr);
    }

    // Fallback to local vector engine
    return this.localFallback.search(queryEmbedding, documentIds, options);
  }
}

/**
 * Factory function to retrieve the active vector store based on environment configuration.
 */
export function getVectorStore(): IVectorStore {
  if (config.vectorSearchProvider === 'atlas') {
    return new AtlasVectorStore();
  }
  return new LocalVectorStore();
}

/**
 * Facade class providing backward-compatible static access to vector store retrieval.
 */
export class VectorStore {
  static async search(
    queryEmbedding: number[],
    documentIds: Types.ObjectId[] | string[],
    options: VectorSearchOptions = {}
  ): Promise<ScoredChunk[]> {
    return getVectorStore().search(queryEmbedding, documentIds, options);
  }
}
