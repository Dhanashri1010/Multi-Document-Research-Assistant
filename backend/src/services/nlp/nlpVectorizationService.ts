import { DocumentModel } from '../../models/Document.js';
import { DocumentChunkModel } from '../../models/DocumentChunk.js';
import { NlpCacheService, computeHash } from '../../models/NlpCache.js';
import { STOPWORDS } from './nlpPreprocessingService.js';
import natural from 'natural';

export interface TfIdfTerm {
  term: string;
  tfidf: number;
  tf: number;
  df: number;
}

export interface DocumentTfIdfResult {
  documentId: string;
  title: string;
  topTerms: TfIdfTerm[];
}

export interface SimilarityMatrixCell {
  docAId: string;
  docATitle: string;
  docBId: string;
  docBTitle: string;
  tfidfSimilarity: number;
  denseSimilarity: number;
}

export interface VectorizationResponse {
  documents: DocumentTfIdfResult[];
  matrix: SimilarityMatrixCell[];
  vocabularySize: number;
  comparisonInsight: string;
}

export class NlpVectorizationService {
  /**
   * Computes TF-IDF vectors, top terms, and pairwise classical vs dense similarity matrices.
   */
  static async vectorizeDocuments(
    documentIds: string[],
    useCache: boolean = true
  ): Promise<VectorizationResponse> {
    if (!documentIds || documentIds.length === 0) {
      throw new Error('At least one document ID is required for vectorization.');
    }

    const cacheKey = documentIds.sort().join(':');
    const contentHash = computeHash(cacheKey);
    const paramsHash = computeHash({ documentIds });
    const promptVersion = 'v1.0';
    const model = 'classical-tfidf-dense-v1';

    if (useCache) {
      const cached = await NlpCacheService.findOne({
        documentId: cacheKey,
        contentHash,
        task: 'vectorization',
        paramsHash,
        promptVersion,
        model,
      });
      if (cached?.result) {
        return cached.result as VectorizationResponse;
      }
    }

    // 1. Fetch documents and their text chunks
    const docs = await DocumentModel.find({ _id: { $in: documentIds } });
    if (docs.length === 0) {
      throw new Error('None of the requested documents were found in the database.');
    }

    const docTexts: { id: string; title: string; tokens: string[] }[] = [];
    const docAvgEmbeddings = new Map<string, number[]>();

    for (const doc of docs) {
      const chunks = await DocumentChunkModel.find({ documentId: doc._id }).select('text embedding');
      const combinedText = chunks.map((c) => c.text).join(' ');
      const tokens = this.tokenizeAndClean(combinedText);
      docTexts.push({
        id: doc._id.toString(),
        title: doc.title || doc.originalName,
        tokens,
      });

      // Compute average dense embedding vector for the document across all its chunks
      const vectorsWithDim = chunks.filter((c) => Array.isArray(c.embedding) && c.embedding.length > 0);
      if (vectorsWithDim.length > 0) {
        const dim = vectorsWithDim[0].embedding.length;
        const avg = new Array(dim).fill(0);
        for (const c of vectorsWithDim) {
          for (let i = 0; i < dim; i++) {
            avg[i] += c.embedding[i];
          }
        }
        for (let i = 0; i < dim; i++) {
          avg[i] /= vectorsWithDim.length;
        }
        docAvgEmbeddings.set(doc._id.toString(), avg);
      }
    }

    // 2. Build Vocabulary and Document Frequency (DF)
    const N = docTexts.length;
    const dfMap = new Map<string, number>();
    const docTfMaps = new Map<string, Map<string, number>>();

    for (const doc of docTexts) {
      const tfMap = new Map<string, number>();
      const seenInDoc = new Set<string>();

      for (const tok of doc.tokens) {
        tfMap.set(tok, (tfMap.get(tok) || 0) + 1);
        seenInDoc.add(tok);
      }
      docTfMaps.set(doc.id, tfMap);

      for (const tok of seenInDoc) {
        dfMap.set(tok, (dfMap.get(tok) || 0) + 1);
      }
    }

    // 3. Compute TF-IDF for each document
    // TF-IDF formula: (tf / total_terms) * (log((1 + N) / (1 + df)) + 1)
    const docResults: DocumentTfIdfResult[] = [];
    const docTfidfVectors = new Map<string, Map<string, number>>();

    for (const doc of docTexts) {
      const tfMap = docTfMaps.get(doc.id) || new Map();
      const totalTerms = doc.tokens.length || 1;
      const tfidfMap = new Map<string, number>();
      const termsList: TfIdfTerm[] = [];

      for (const [term, tf] of tfMap.entries()) {
        const df = dfMap.get(term) || 1;
        const normalizedTf = tf / totalTerms;
        const idf = Math.log((1 + N) / (1 + df)) + 1;
        const score = normalizedTf * idf;

        tfidfMap.set(term, score);
        termsList.push({
          term,
          tfidf: Math.round(score * 10000) / 10000,
          tf,
          df,
        });
      }

      docTfidfVectors.set(doc.id, tfidfMap);

      // Sort by TF-IDF descending and pick top 20
      termsList.sort((a, b) => b.tfidf - a.tfidf);
      docResults.push({
        documentId: doc.id,
        title: doc.title,
        topTerms: termsList.slice(0, 20),
      });
    }

    // 4. Compute Pairwise Cosine Similarity Matrix (TF-IDF vs Dense)
    const matrix: SimilarityMatrixCell[] = [];

    for (let i = 0; i < docTexts.length; i++) {
      for (let j = 0; j < docTexts.length; j++) {
        const docA = docTexts[i];
        const docB = docTexts[j];

        // TF-IDF Cosine Similarity
        const vecA = docTfidfVectors.get(docA.id)!;
        const vecB = docTfidfVectors.get(docB.id)!;
        const tfidfSim = this.computeSparseCosine(vecA, vecB);

        // Dense Embedding Cosine Similarity
        const denseA = docAvgEmbeddings.get(docA.id);
        const denseB = docAvgEmbeddings.get(docB.id);
        const denseSim = denseA && denseB ? this.computeDenseCosine(denseA, denseB) : 0;

        matrix.push({
          docAId: docA.id,
          docATitle: docA.title,
          docBId: docB.id,
          docBTitle: docB.title,
          tfidfSimilarity: Math.round(tfidfSim * 1000) / 1000,
          denseSimilarity: Math.round(denseSim * 1000) / 1000,
        });
      }
    }

    // 5. Synthesis Comparison Insight
    const offDiagonalCells = matrix.filter((c) => c.docAId !== c.docBId);
    let avgTfidf = 0;
    let avgDense = 0;
    if (offDiagonalCells.length > 0) {
      avgTfidf = offDiagonalCells.reduce((acc, c) => acc + c.tfidfSimilarity, 0) / offDiagonalCells.length;
      avgDense = offDiagonalCells.reduce((acc, c) => acc + c.denseSimilarity, 0) / offDiagonalCells.length;
    }

    const comparisonInsight =
      offDiagonalCells.length > 0
        ? `Classical TF-IDF lexical overlap averaged ${(avgTfidf * 100).toFixed(1)}%, while semantic dense embeddings captured deeper conceptual alignment averaging ${(avgDense * 100).toFixed(1)}%. Dense embeddings bridged vocabulary mismatches across documents.`
        : 'Single document analyzed: TF-IDF keywords successfully extracted for salient topics.';

    const response: VectorizationResponse = {
      documents: docResults,
      matrix,
      vocabularySize: dfMap.size,
      comparisonInsight,
    };

    if (useCache) {
      await NlpCacheService.findOneAndUpdate(
        { documentId: cacheKey, contentHash, task: 'vectorization', paramsHash, promptVersion, model },
        { result: response },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    return response;
  }

  private static tokenizeAndClean(text: string): string[] {
    const rawTokens = text.toLowerCase().match(/[a-z0-9_-]{2,}/gi) || [];
    return rawTokens
      .map((t) => t.trim())
      .filter((t) => !STOPWORDS.has(t) && t.length >= 3 && !/^\d+$/.test(t));
  }

  private static computeSparseCosine(vecA: Map<string, number>, vecB: Map<string, number>): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (const val of vecA.values()) {
      normA += val * val;
    }
    for (const val of vecB.values()) {
      normB += val * val;
    }

    if (normA === 0 || normB === 0) return 0;

    for (const [key, valA] of vecA.entries()) {
      const valB = vecB.get(key);
      if (valB !== undefined) {
        dot += valA * valB;
      }
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private static computeDenseCosine(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
