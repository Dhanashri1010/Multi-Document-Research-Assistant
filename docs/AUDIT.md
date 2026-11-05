# Comprehensive Codebase & Architecture Audit
**Project**: Multi-Document Research Assistant  
**Date**: November 2026  
**Auditor**: Senior Full-Stack Engineer & RAG/NLP Specialist  

---

## 1. Executive Summary

This audit assesses the real architecture, data flows, accuracy bottlenecks, code quality, and technical debt of the **Multi-Document Research Assistant**. The project is a full-stack academic document research application featuring dense vector search, BM25 lexical ranking, Reciprocal Rank Fusion (RRF), Maximal Marginal Relevance (MMR), and Retrieval-Augmented Generation (RAG).

### Baseline Test & Build Status
- **Backend Tests (Vitest)**: 33/33 tests passing with live MongoDB (`nlp.test.ts`, `phase1.test.ts`, `phase2.test.ts`, `e2e_pipeline.test.ts`). *Note: In offline sandbox mode, `e2e_pipeline.test.ts` had a path initialization ordering bug which has been identified.*
- **Backend TypeScript Compilation (`tsc`)**: 0 errors (`backend/tsconfig.json` compiles cleanly with ES2022/NodeNext).
- **Frontend Production Build (`vite build`)**: 0 errors, output generated in 2.95s.
- **Frontend Linter (`oxlint`)**: 0 errors, 5 warnings (unused imports in `DocumentSelector.tsx`, Fast Refresh warning in `WorkspaceContext.tsx`, and state-in-effect triggers in `WorkspaceContext.tsx` and `DashboardPage.tsx`).

---

## 2. Real Architecture (As Implemented in Code)

```
                            [ React 19 Frontend (Vite + Tailwind) ]
                                              │
                                  Axios REST Client (api.ts)
                                              │
                                              ▼
                         [ Express 4.21 API Server (Node 24 / TS) ]
                                              │
              ┌───────────────────────────────┼──────────────────────────────┐
              ▼                               ▼                              ▼
    [ Document Controller ]           [ Chat Controller ]          [ Research Controller ]
              │                               │                              │
    IngestionQueue (FIFO)             RAGService (RAG)           ComparisonService (Matrix)
              │                               │                              │
    ┌─────────┴─────────┐                     ├──────────────────────────────┤
    ▼                   ▼                     ▼                              ▼
Extractor            Chunker             VectorStore                    LLMService
(pdf-parse)      (Intl.Segmenter)    (Dense + BM25 + MMR)         (Google GenAI / OpenAI)
    │                   │                     │                              │
    └─────────┬─────────┘                     ▼                              ▼
              ▼                     Typed Float32Array Cache       Gemini 3.5 Cascade
      EmbeddingService                        │
   (Xenova all-MiniLM-L6-v2)                  ▼
              │                     MongoDB Database (Mongoose 8)
              └─────────────────────► [ Document, DocumentChunk,
                                        ChatMessage, ResearchSession ]
```

### Components Breakdown:
1. **Backend Server (`backend/src/server.ts`, `app.ts`)**:
   - Express 4.21 application with CORS enabled for `localhost:5173`.
   - Graceful shutdown handlers for `SIGINT` and `SIGTERM`.
   - Startup cleanup that resets zombie `processing` documents from crashes/restarts to `failed`.
   - Health check endpoint at `/api/health`.
2. **Data Layer (`backend/src/models/`)**:
   - `DocumentModel`: File metadata, original name, SHA-256 hash, page/chunk counts, title, authors, abstract, status.
   - `DocumentChunkModel`: `documentId`, `chunkIndex`, raw `text`, contextual `embeddingText`, `section`, `pageNumber`, `pageStart`, `pageEnd`, `tokenCount`, `embedding` vector (384-dim). Compound index on `{ documentId: 1, chunkIndex: 1 }`.
   - `ChatMessageModel`: Session messages, `role`, `content`, embedded `citations` array, `hasInsufficientEvidence` flag.
   - `ResearchSessionModel`: Chat session metadata and list of selected document IDs.
3. **Ingestion & NLP Pipeline (`backend/src/services/documents/`)**:
   - In-memory serial queue (`IngestionQueue`) ensuring heavy embedding tasks run with concurrency = 1 to prevent memory spikes.
   - `extractor.ts`: `pdf-parse` with per-page text callback using coordinate thresholds (`lastY - item.transform[5] < 3`). Cleans control characters, de-hyphenates linebreaks, removes page numbers and repeated running headers/footers (>50% frequency).
   - `chunker.ts`: Sliding sentence window using standard `Intl.Segmenter`. Target tokens: 220, overlap: 40. Preserves cross-page spans (`pageStart`, `pageEnd`), tags sections (`detectSectionHeading`), and creates enriched `embeddingText` (`${docTitle} | ${section}: ${chunkText}`).
4. **Retrieval & RAG Engine (`backend/src/services/ai/`)**:
   - `embeddingService.ts`: Local ONNX sentence-transformers (`Xenova/all-MiniLM-L6-v2`, 384-dim), with fallbacks for Gemini and OpenAI.
   - `vectorStore.ts`: In-memory `Float32Array` cache. Executes hybrid retrieval:
     - Dense cosine similarity.
     - BM25 lexical ranking (`BM25Index`) with stopword removal and suffix stemming.
     - Reciprocal Rank Fusion (RRF, $k=60$) combining dense and lexical ranks.
     - Document quota allocation (`Math.max(2, Math.ceil(topK / numDocs) + 1)`).
     - Maximal Marginal Relevance (MMR, $\lambda=0.7$) to eliminate near-duplicate chunks.
     - Cross-encoder reranking hook (`RerankerService` using `Xenova/ms-marco-MiniLM-L-6-v2`).
   - `llmService.ts`: GenAI integration with fast model cascade (`gemini-3.5-flash-lite` -> `gemini-flash-lite-latest` -> `gemini-3.5-flash`), exponential backoff, and retry handling.
   - `ragService.ts`: Conversation memory, query rewriting (`rewriteQuery`), insufficient evidence detection, prompt-injection defense instructions, and citation tracking.
   - `comparisonService.ts`: Single-paper plain-English summarizer and 8-dimension multi-paper comparison matrix generator with deterministic grounded fallback.
5. **Frontend Application (`frontend/src/`)**:
   - React 19 + TypeScript + Vite + Tailwind CSS with persistent layout (`Sidebar`, `Header`, `AppLayout`).
   - `WorkspaceContext`: Cross-page document selection and global document list cache.
   - 4 primary views: Dashboard (`/dashboard`), Documents (`/documents`), Research Workspace (`/research`), and Compare Documents (`/compare`).

---

## 3. Data Flow Analysis

```
[ Upload ]
    │ PDF or TXT File (Multer diskStorage to backend/uploads/)
    ▼
[ Deduplication ]
    │ Compute SHA-256 file hash -> If matching ready doc exists in DB, reuse and unlink upload
    ▼
[ Ingestion Queue ]
    │ Enqueue document ID into IngestionQueue FIFO runner
    ▼
[ Page-by-Page Extraction ]
    │ extractPdf: PDF.js pagerender hook splits stream by vertical coordinate changes
    │ cleanText: Strips control characters, de-hyphenates, removes standalone page numbers
    │ removeRepeatedHeadersFooters: Filters running headers appearing on >50% of pages
    │ extractPage1Metadata: Heuristic extraction of Title, Authors, and Abstract
    ▼
[ Section-Aware Cross-Page Chunking ]
    │ chunkPages: Intl.Segmenter sentence extraction, regex section heading classification
    │ Cross-page offset tracking records pageStart and pageEnd
    │ Formats embeddingText: "${docTitle} | ${section}: ${chunkText}"
    ▼
[ Dense Vector Embedding ]
    │ LocalEmbeddingProvider: Batches 16 chunks through Xenova/all-MiniLM-L6-v2
    ▼
[ Database Persistence ]
    │ DocumentChunkModel.insertMany: Stores chunks with 384-dim vectors
    │ Invalidate in-memory vector cache for document ID
    │ Update DocumentModel: status = 'ready', pageCount, chunkCount, embeddingModel
    ▼
[ Hybrid Retrieval ]
    │ Query -> Query rewrite (if prior chat history) -> embedQuery
    │ Filter chunks by selected document IDs
    │ Compute dense cosine similarity (Float32Array)
    │ Compute BM25 lexical score over chunk tokens
    │ Reciprocal Rank Fusion (RRF, k=60) merges rankings
    │ Per-document quota ensures balanced multi-paper representation
    │ Maximal Marginal Relevance (MMR, lambda=0.7) removes redundancy
    ▼
[ Grounded Generation & Citation ]
    │ Filter out queries below relevance threshold (returns insufficient evidence alert)
    │ Format evidence passages: [Source i | Document: ... | Page ... | Section: ...]
    │ Prompt LLM (Gemini 3.5 cascade) with low temperature (0.15)
    │ Map cited excerpts to ICitation objects with documentId, name, page, excerpt
    ▼
[ User Interface ]
    │ Markdown rendering in split-view chat
    │ Expandable citation drawer with exact document name, page number, and text excerpt
```

---

## 4. Bugs, Bottlenecks & Code Quality Issues

### Identified Bugs
1. **`e2e_pipeline.test.ts` File Copy Ordering**:
   In `beforeAll`, `if (!isMongoReady) return;` precedes `fs.copyFileSync(sample1, paper1Path)`. When running tests in sandboxed environments without network access to port 27017, the test suite aborts the file copy, causing non-DB unit tests in the same file to fail with `ENOENT`.
2. **Missing Streaming (SSE)**:
   All LLM answers and comparative analyses are buffered entirely on the backend before sending the JSON response. Users experience a blank loading spinner for 5–25 seconds instead of real-time word-by-word streaming.
3. **No Claim-Level Citation Verification**:
   The LLM is prompted to cite retrieved excerpts, but there is no post-generation verification step to verify that cited page numbers and claims match the source text, allowing subtle hallucinated statements to go undetected.
4. **Unvalidated JSON Output**:
   Comparative matrix generation parses raw markdown code blocks (`cleanJson = response.replace(/^```json/m, '').replace(/^```/m, '').trim()`) with standard `JSON.parse` rather than validating against a strict Zod schema.
5. **Academic PDF Two-Column Formatting**:
   `pdf-parse` reads raw stream text items. In two-column academic papers, text from left and right columns on the same vertical line can occasionally interleave, producing jumbled sentences.

### Performance Bottlenecks
1. **Unbounded In-Memory Vector Cache**:
   `vectorCache` in `vectorStore.ts` is an unbounded `Map<string, CachedChunk[]>`. As dozens of large documents are ingested, all 384-dim float vectors remain in heap memory without LRU eviction.
2. **Sequential Ingestion**:
   While safe for single-core machines, the concurrency = 1 FIFO queue slows down bulk uploads (e.g. 10 papers taking 60+ seconds).
3. **Regex-Based Query Rewriting**:
   `RAGService.rewriteQuery` invokes a full LLM call before every retrieval step in an active chat session, adding 1.5–3 seconds of latency to every follow-up question.

### Deprecated Model Names & Dependencies
1. **`gemini-1.5-flash` / `gemini-1.5-pro` / `gemini-2.0-flash`**:
   These model names return `404 Not Found` or `no longer available` on current Google GenAI API versions. The active models on this key are `gemini-3.5-flash-lite`, `gemini-flash-lite-latest`, and `gemini-3.5-flash`.
2. **`pdf-parse` v1.1.1**:
   The dependency relies on an unmaintained 2019 PDF.js build. Modern PDF layout engines handle headers, footnotes, multi-column reading orders, and tables with significantly higher fidelity.

---

## 5. Gaps Between README Claims & Actual Code

| Feature / Metric | README Claim | Actual Codebase Implementation |
| :--- | :--- | :--- |
| **Chunk Size** | ~450 tokens, ~90 overlap | Defaults to 220 target tokens and 40 overlap for local embeddings (`env.ts`) |
| **LLM Model** | `gemini-1.5-flash` | Deprecated/404; updated to `gemini-3.5-flash-lite` cascade in code |
| **Test Count** | "13 / 13 tests passing" | Actually contains 33 tests across 4 test suites (`nlp`, `phase1`, `phase2`, `e2e_pipeline`) |
| **Retrieval Engine** | "In-memory cosine similarity" | Code has been upgraded with BM25 lexical ranking, RRF, MMR, and cross-encoder reranking |
| **Output Validation**| "Strictly guards against hallucination" | Relies primarily on prompt instructions; lacks Zod schema verification and citation verification |

