import { DocumentChunkModel } from '../../models/DocumentChunk.js';
import { NlpCacheService, computeHash } from '../../models/NlpCache.js';
import { LLMService } from '../ai/llmService.js';
import { STOPWORDS } from './nlpPreprocessingService.js';

export interface ChunkPoint {
  id: string;
  documentId: string;
  documentName?: string;
  chunkIndex: number;
  textSnippet: string;
  vector: number[];
  x?: number;
  y?: number;
  cluster?: number;
}

export interface TopicInfo {
  topicId: number;
  title: string;
  keywords: { word: string; score: number }[];
  chunkCount: number;
  coherenceScore: number;
}

export interface DocumentTopicShare {
  documentId: string;
  documentName: string;
  topicDistribution: Record<number, number>; // topicId -> percentage
}

export interface TopicModelingResult {
  k: number;
  silhouetteScore: number;
  coherenceScore: number;
  topics: TopicInfo[];
  points: {
    id: string;
    documentId: string;
    documentName: string;
    chunkIndex: number;
    textSnippet: string;
    x: number;
    y: number;
    cluster: number;
  }[];
  documentDistributions: DocumentTopicShare[];
  totalChunksAnalyzed: number;
  cached?: boolean;
}

export class NlpTopicService {
  /**
   * Runs end-to-end K-Means clustering, c-TF-IDF keyword extraction, PCA 2D projection,
   * silhouette and coherence evaluation on stored document chunk embeddings.
   */
  static async runTopicModeling(options: {
    documentIds?: string[];
    k?: number; // 2..6, or undefined for auto-selection via silhouette
    sampleMax?: number;
    generateAiTitles?: boolean;
    forceRefresh?: boolean;
    userId?: string;
  }): Promise<TopicModelingResult> {
    const sampleMax = options.sampleMax ?? 500;
    const filter: any = { embedding: { $exists: true, $ne: [] } };
    if (options.userId) {
      filter.userId = options.userId;
    }
    if (options.documentIds && options.documentIds.length > 0) {
      filter.documentId = { $in: options.documentIds };
    }

    // 1. Fetch chunks with existing embeddings
    const rawChunks = await DocumentChunkModel.find(filter)
      .select('documentId chunkIndex text embedding')
      .populate('documentId', 'title originalName')
      .lean();

    if (!rawChunks || rawChunks.length < 10) {
      throw new Error(
        `At least 10 embedded text chunks are required for cross-document topic modeling; found ${rawChunks?.length || 0}. Please upload more documents or allow indexing to finish.`
      );
    }

    // Stratified or uniform sampling up to sampleMax
    let sampled = rawChunks;
    if (rawChunks.length > sampleMax) {
      const step = Math.floor(rawChunks.length / sampleMax);
      sampled = [];
      for (let i = 0; i < rawChunks.length && sampled.length < sampleMax; i += step) {
        sampled.push(rawChunks[i]);
      }
    }

    const cacheKey = `topics_${options.documentIds?.sort().join('_') || 'all'}`;
    const paramsHash = computeHash({ k: options.k, sampleMax, sampleCount: sampled.length });

    if (!options.forceRefresh) {
      const cached = await NlpCacheService.findOne({
        documentId: cacheKey,
        task: 'topic_modeling',
        paramsHash,
      });
      if (cached?.result) {
        return { ...cached.result, cached: true };
      }
    }

    const points: ChunkPoint[] = sampled.map((c: any) => ({
      id: c._id.toString(),
      documentId: c.documentId?._id?.toString() || c.documentId?.toString() || 'unknown',
      documentName: c.documentId?.title || c.documentId?.originalName || 'Document',
      chunkIndex: c.chunkIndex,
      textSnippet: c.text.slice(0, 160).trim() + (c.text.length > 160 ? '...' : ''),
      vector: c.embedding,
    }));

    const vectors = points.map((p) => p.vector);

    // 2. Select K: if specified, use it (clamped 2..6); otherwise evaluate k=2..6 by silhouette
    let bestK = options.k ? Math.min(6, Math.max(2, options.k)) : 3;
    let bestClusters: number[] = [];
    let bestSilhouette = -1;

    if (options.k) {
      bestClusters = this.kMeans(vectors, bestK);
      bestSilhouette = this.computeSilhouette(vectors, bestClusters, bestK);
    } else {
      const maxKCandidate = Math.min(6, Math.max(2, Math.floor(vectors.length / 5)));
      for (let candK = 2; candK <= maxKCandidate; candK++) {
        const clusters = this.kMeans(vectors, candK);
        const sil = this.computeSilhouette(vectors, clusters, candK);
        if (sil > bestSilhouette) {
          bestSilhouette = sil;
          bestK = candK;
          bestClusters = clusters;
        }
      }
    }

    for (let i = 0; i < points.length; i++) {
      points[i].cluster = bestClusters[i];
    }

    // 3. Compute 2D PCA Projection
    const projected2D = this.computePCA2D(vectors);
    for (let i = 0; i < points.length; i++) {
      points[i].x = Math.round(projected2D[i][0] * 1000) / 1000;
      points[i].y = Math.round(projected2D[i][1] * 1000) / 1000;
    }

    // 4. c-TF-IDF Keywords per cluster
    const clusterTexts: string[][] = Array.from({ length: bestK }, () => []);
    points.forEach((p, idx) => {
      const c = bestClusters[idx];
      clusterTexts[c].push(sampled[idx].text);
    });

    const topicKeywords = this.computeClassTfIdf(clusterTexts);

    // 5. Coherence Score (Mean Pairwise Term Association)
    const topicCoherences = topicKeywords.map((kwList, clusterIdx) => {
      const topWords = kwList.slice(0, 5).map((k) => k.word);
      return this.computeTopicCoherence(topWords, clusterTexts[clusterIdx]);
    });
    const avgCoherence =
      topicCoherences.length > 0
        ? Math.round((topicCoherences.reduce((a, b) => a + b, 0) / topicCoherences.length) * 100) / 100
        : 0;

    // 6. Optional Gemini Topic Titles (batched 1 call) or local fallback
    let topicTitles: string[] = topicKeywords.map(
      (kw, i) => kw.slice(0, 3).map((w) => w.word.charAt(0).toUpperCase() + w.word.slice(1)).join(', ') || `Topic ${i + 1}`
    );

    if (options.generateAiTitles) {
      try {
        const payload = topicKeywords.map((kw, idx) => ({
          topicId: idx,
          topKeywords: kw.slice(0, 6).map((w) => w.word),
        }));
        const prompt = `Generate a concise 3-to-4 word scholarly topic title for each keyword cluster below.
Clusters:
${JSON.stringify(payload, null, 2)}

Respond with STRICT JSON format:
{
  "titles": [
    { "topicId": 0, "title": "Concise Topic Title" }
  ]
}`;
        const raw = await LLMService.generate(prompt, {
          temperature: 0.2,
          systemPrompt: 'You are an NLP scientific topic labeler. Output JSON only.',
        });
        const clean = raw.replace(/^```json/m, '').replace(/^```/m, '').trim();
        const parsed = JSON.parse(clean);
        if (parsed?.titles && Array.isArray(parsed.titles)) {
          for (const item of parsed.titles) {
            if (typeof item.topicId === 'number' && item.title) {
              topicTitles[item.topicId] = item.title;
            }
          }
        }
      } catch (err: any) {
        console.warn(`[NlpTopicService] AI topic naming fallback: ${err.message}`);
      }
    }

    // 7. Assemble Topics
    const topics: TopicInfo[] = topicKeywords.map((keywords, idx) => ({
      topicId: idx,
      title: topicTitles[idx] || `Topic ${idx + 1}`,
      keywords: keywords.slice(0, 8),
      chunkCount: clusterTexts[idx].length,
      coherenceScore: topicCoherences[idx] ?? 0.5,
    }));

    // 8. Document-Topic Distribution
    const docMap = new Map<string, { name: string; clusterCounts: number[]; total: number }>();
    points.forEach((p) => {
      if (!docMap.has(p.documentId)) {
        docMap.set(p.documentId, {
          name: p.documentName || 'Document',
          clusterCounts: new Array(bestK).fill(0),
          total: 0,
        });
      }
      const entry = docMap.get(p.documentId)!;
      entry.clusterCounts[p.cluster!]++;
      entry.total++;
    });

    const documentDistributions: DocumentTopicShare[] = [];
    docMap.forEach((val, docId) => {
      const dist: Record<number, number> = {};
      for (let kIdx = 0; kIdx < bestK; kIdx++) {
        dist[kIdx] = val.total > 0 ? Math.round((val.clusterCounts[kIdx] / val.total) * 100) : 0;
      }
      documentDistributions.push({
        documentId: docId,
        documentName: val.name,
        topicDistribution: dist,
      });
    });

    const result: TopicModelingResult = {
      k: bestK,
      silhouetteScore: Math.round(bestSilhouette * 100) / 100,
      coherenceScore: avgCoherence,
      topics,
      points: points.map((p) => ({
        id: p.id,
        documentId: p.documentId,
        documentName: p.documentName || 'Document',
        chunkIndex: p.chunkIndex,
        textSnippet: p.textSnippet,
        x: p.x!,
        y: p.y!,
        cluster: p.cluster!,
      })),
      documentDistributions,
      totalChunksAnalyzed: points.length,
    };

    // Cache result
    await NlpCacheService.findOneAndUpdate(
      {
        documentId: cacheKey,
        contentHash: computeHash(points.map((p) => p.id).join(',')),
        task: 'topic_modeling',
        paramsHash,
        promptVersion: 'v1.0',
        model: 'kmeans-ctfidf',
      },
      { result }
    );

    return result;
  }

  /**
   * K-Means clustering with K-Means++ initialization.
   */
  private static kMeans(vectors: number[][], k: number, maxIters = 40): number[] {
    const n = vectors.length;
    const dim = vectors[0].length;
    if (k >= n) return Array.from({ length: n }, (_, i) => i % k);

    // K-Means++ centroid initialization
    const centroids: number[][] = [];
    centroids.push(vectors[Math.floor(Math.random() * n)].slice());

    while (centroids.length < k) {
      const dists: number[] = [];
      let sumDist = 0;
      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        for (const c of centroids) {
          const d = this.euclideanDistanceSq(vectors[i], c);
          if (d < minDist) minDist = d;
        }
        dists.push(minDist);
        sumDist += minDist;
      }
      let r = Math.random() * (sumDist || 1);
      let nextIdx = 0;
      for (let i = 0; i < n; i++) {
        r -= dists[i];
        if (r <= 0) {
          nextIdx = i;
          break;
        }
      }
      centroids.push(vectors[nextIdx].slice());
    }

    let assignments = new Array(n).fill(0);

    for (let iter = 0; iter < maxIters; iter++) {
      let changed = false;

      // Assign to closest centroid
      for (let i = 0; i < n; i++) {
        let bestDist = Infinity;
        let bestC = 0;
        for (let c = 0; c < k; c++) {
          const d = this.euclideanDistanceSq(vectors[i], centroids[c]);
          if (d < bestDist) {
            bestDist = d;
            bestC = c;
          }
        }
        if (assignments[i] !== bestC) {
          assignments[i] = bestC;
          changed = true;
        }
      }

      if (!changed && iter > 2) break;

      // Update centroids
      const counts = new Array(k).fill(0);
      const newCentroids = Array.from({ length: k }, () => new Array(dim).fill(0));

      for (let i = 0; i < n; i++) {
        const c = assignments[i];
        counts[c]++;
        for (let d = 0; d < dim; d++) {
          newCentroids[c][d] += vectors[i][d];
        }
      }

      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let d = 0; d < dim; d++) {
            centroids[c][d] = newCentroids[c][d] / counts[c];
          }
        }
      }
    }

    return assignments;
  }

  /**
   * Fast silhouette score computation (sampled if n > 300).
   */
  private static computeSilhouette(vectors: number[][], assignments: number[], k: number): number {
    const n = vectors.length;
    if (k <= 1 || n <= k) return 0;

    const sampleStep = n > 300 ? Math.ceil(n / 300) : 1;
    let totalScore = 0;
    let count = 0;

    for (let i = 0; i < n; i += sampleStep) {
      const myCluster = assignments[i];

      // a(i): average distance to same cluster
      let sameDist = 0;
      let sameCount = 0;

      // b(i): min average distance to other clusters
      const otherDists = new Array(k).fill(0);
      const otherCounts = new Array(k).fill(0);

      for (let j = 0; j < n; j += sampleStep) {
        if (i === j) continue;
        const d = Math.sqrt(this.euclideanDistanceSq(vectors[i], vectors[j]));
        const c = assignments[j];
        if (c === myCluster) {
          sameDist += d;
          sameCount++;
        } else {
          otherDists[c] += d;
          otherCounts[c]++;
        }
      }

      const a = sameCount > 0 ? sameDist / sameCount : 0;
      let b = Infinity;
      for (let c = 0; c < k; c++) {
        if (c !== myCluster && otherCounts[c] > 0) {
          const avg = otherDists[c] / otherCounts[c];
          if (avg < b) b = avg;
        }
      }

      if (b === Infinity) b = 0;
      const maxVal = Math.max(a, b);
      if (maxVal > 0) {
        totalScore += (b - a) / maxVal;
        count++;
      }
    }

    return count > 0 ? totalScore / count : 0;
  }

  /**
   * c-TF-IDF (Class-based Term Frequency - Inverse Document Frequency).
   */
  private static computeClassTfIdf(clusterTexts: string[][]): { word: string; score: number }[][] {
    const k = clusterTexts.length;
    const termClusterCounts: Map<string, number>[] = Array.from({ length: k }, () => new Map());
    const clusterTotalWords: number[] = new Array(k).fill(0);
    const globalDocFreq = new Map<string, number>();

    // Tokenize each cluster
    for (let c = 0; c < k; c++) {
      const text = clusterTexts[c].join(' ').toLowerCase();
      const tokens = text
        .replace(/[^\w\s-]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t) && isNaN(Number(t)));

      clusterTotalWords[c] = tokens.length;
      const seenInCluster = new Set<string>();

      for (const t of tokens) {
        termClusterCounts[c].set(t, (termClusterCounts[c].get(t) || 0) + 1);
        seenInCluster.add(t);
      }

      for (const t of seenInCluster) {
        globalDocFreq.set(t, (globalDocFreq.get(t) || 0) + 1);
      }
    }

    const avgWordsPerCluster = clusterTotalWords.reduce((a, b) => a + b, 0) / (k || 1);
    const results: { word: string; score: number }[][] = [];

    for (let c = 0; c < k; c++) {
      const scores: { word: string; score: number }[] = [];
      const totalWords = clusterTotalWords[c] || 1;

      termClusterCounts[c].forEach((count, term) => {
        const tf = count / totalWords;
        const df = globalDocFreq.get(term) || 1;
        const idf = Math.log(1 + avgWordsPerCluster / (df || 1));
        const cTfIdf = tf * idf;
        scores.push({ word: term, score: Math.round(cTfIdf * 1000) / 1000 });
      });

      scores.sort((a, b) => b.score - a.score);
      results.push(scores.slice(0, 15));
    }

    return results;
  }

  /**
   * Computes topic coherence via word co-occurrence across cluster chunks.
   */
  private static computeTopicCoherence(topWords: string[], chunks: string[]): number {
    if (topWords.length < 2 || chunks.length === 0) return 0.5;
    const wordChunkSets = topWords.map((w) => {
      const lower = w.toLowerCase();
      const matchingIndices = new Set<number>();
      chunks.forEach((chunk, i) => {
        if (chunk.toLowerCase().includes(lower)) matchingIndices.add(i);
      });
      return matchingIndices;
    });

    let pairScoreSum = 0;
    let pairsCount = 0;
    const eps = 1e-12;

    for (let i = 1; i < topWords.length; i++) {
      for (let j = 0; j < i; j++) {
        const docCountJ = wordChunkSets[j].size;
        let coOccur = 0;
        wordChunkSets[i].forEach((docIdx) => {
          if (wordChunkSets[j].has(docIdx)) coOccur++;
        });
        const score = Math.log((coOccur + 1) / (docCountJ + 1 + eps));
        pairScoreSum += score;
        pairsCount++;
      }
    }

    const avgScore = pairsCount > 0 ? pairScoreSum / pairsCount : 0;
    // Normalize into [0, 1] range for intuitive presentation
    const normalized = 1 / (1 + Math.exp(-avgScore));
    return Math.round(normalized * 100) / 100;
  }

  /**
   * 2D PCA projection of vectors using power iteration to find top 2 principal components.
   */
  private static computePCA2D(vectors: number[][]): number[][] {
    const n = vectors.length;
    const dim = vectors[0].length;
    if (n === 0 || dim === 0) return [];

    // 1. Center the data
    const mean = new Array(dim).fill(0);
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < dim; d++) mean[d] += vectors[i][d];
    }
    for (let d = 0; d < dim; d++) mean[d] /= n;

    const centered: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: dim }, (_, d) => vectors[i][d] - mean[d])
    );

    // 2. Find 1st principal component via power iteration
    const pc1 = this.powerIteration(centered, dim);

    // 3. Deflate data along pc1 to find 2nd principal component
    const deflated = centered.map((row) => {
      const proj = this.dot(row, pc1);
      return row.map((val, d) => val - proj * pc1[d]);
    });
    const pc2 = this.powerIteration(deflated, dim);

    // 4. Project centered data onto [pc1, pc2]
    return centered.map((row) => [this.dot(row, pc1), this.dot(row, pc2)]);
  }

  private static powerIteration(data: number[][], dim: number, iters = 25): number[] {
    let b = Array.from({ length: dim }, () => Math.random() - 0.5);
    let norm = Math.sqrt(b.reduce((acc, v) => acc + v * v, 0)) || 1;
    b = b.map((v) => v / norm);

    for (let iter = 0; iter < iters; iter++) {
      const nextB = new Array(dim).fill(0);
      for (const row of data) {
        const dotVal = this.dot(row, b);
        for (let d = 0; d < dim; d++) {
          nextB[d] += dotVal * row[d];
        }
      }
      norm = Math.sqrt(nextB.reduce((acc, v) => acc + v * v, 0)) || 1e-10;
      b = nextB.map((v) => v / norm);
    }
    return b;
  }

  private static euclideanDistanceSq(a: number[], b: number[]): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return sum;
  }

  private static dot(a: number[], b: number[]): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) sum += a[i] * b[i];
    return sum;
  }
}

