# RAG & Architecture Improvement Plan
**Project**: Multi-Document Research Assistant  
**Date**: November 2026  
**Status**: Step 0 Complete — Plan Proposed (Pending User Confirmation Before Phase 1)  

---

## 1. Impact vs. Effort Prioritization Matrix

| Phase | Core Objective | Impact | Effort | Priority Rank |
| :--- | :--- | :---: | :---: | :---: |
| **Phase 1** | **Retrieval Accuracy**: Strict multi-provider vector interface, model-dimension consistency enforcement, multi-document balanced quota, configurable cross-encoder reranking, and MMR deduplication. | **Very High** | Medium | **#1** |
| **Phase 2** | **Ingestion Quality**: Column-aware PDF parsing (prevent horizontal line interleaving), encrypted/scanned PDF detection, reference stripping, and enhanced metadata extraction (title, authors, year, abstract). | **Very High** | Medium | **#2** |
| **Phase 3** | **Grounded Generation & Streaming**: SSE answer streaming to UI, Zod-validated structured outputs, claim-to-chunk citation verification, and hardened prompt injection protection. | **High** | Medium-High | **#3** |
| **Phase 4** | **Evaluation Harness**: 30–50 benchmark ground-truth QA dataset from `samples/`, Hit@k, MRR, faithfulness scoring, and `docs/EVAL_RESULTS.md`. | **High** | Medium | **#4** |
| **Phase 6** | **Robustness & Code Quality**: Zod env validation, pino structured logger, magic-byte upload validation, compound MongoDB indexes, ESLint/Prettier, eliminating `any`. | **Medium-High** | Medium | **#5** |
| **Phase 5** | **Product Features**: In-app PDF viewer with page deep-linking, Markdown/PDF exports, paper collections/projects, arXiv/DOI import, and contradiction synthesis. | **High** | High | **#6** |
| **Phase 7** | **Documentation & Comprehensive Tests**: Full test suite for edge cases, corrupt uploads, component unit tests, and production README rewrite. | **Medium** | Low-Medium | **#7** |

---

## 2. Phase-by-Phase Implementation Specifications

```
  Phase 1: Retrieval Accuracy ────────► Phase 2: Ingestion Quality
             │                                     │
             ▼                                     ▼
  Phase 3: Grounded Generation ───────► Phase 4: Evaluation Benchmark
             │                                     │
             ▼                                     ▼
  Phase 5: Product Features ──────────► Phase 6: Robustness & Types
                                                   │
                                                   ▼
                                        Phase 7: Full Docs & Tests
```

### Phase 1: Retrieval Accuracy
1. **Vector Store Interface (`IVectorStore`)**:
   - Extract `VectorStore` into an abstract interface supporting both `LocalVectorStore` (in-memory Float32Array + BM25 + RRF) and `AtlasVectorStore` (`$vectorSearch`).
2. **Embedding Model & Dimension Safety**:
   - Record `embeddingModel` and `embeddingDim` on every chunk.
   - Refuse retrieval across documents indexed with mismatched dimensions (e.g. 384 vs 768) and return a clear remediation message guiding the user to re-index.
3. **Multi-Document Fair Quota Retrieval**:
   - Retrieve top 20–30 candidates globally, guarantee proportional per-selected-document quotas so a 50-page paper cannot suppress a 4-page paper, then apply MMR ($\lambda=0.7$) to eliminate near-duplicate passages.
4. **Configurable Reranking**:
   - Configurable cross-encoder pipeline (`RERANKER=on|off`), with transparent no-op fallback when models are uninitialized or in resource-constrained environments.

### Phase 2: Ingestion Quality
1. **Academic PDF Extraction Upgrade**:
   - Enhance PDF text extraction to handle two-column academic layouts, prevent horizontal column interleaving, and extract bounding coordinates.
   - Strip bibliography/references sections, running headers, and running footers before embedding to keep vectors clean.
2. **Scanned & Protected Document Gate**:
   - Detect scanned PDFs (0 text chars or high image ratio) and password-encrypted/corrupt PDFs upfront. Return explicit user-friendly errors (`"Document appears to be scanned or image-only"`).
3. **Academic Metadata Extraction**:
   - Robust extractor for paper title, author list, publication year, and abstract on upload.

### Phase 3: Grounded Generation & Streaming
1. **Server-Sent Events (SSE) Streaming**:
   - Stream answer tokens to the React UI in real time via an `/api/chat/ask/stream` endpoint, replacing the 5–15s blank loading spinner.
2. **Structured Outputs with Zod**:
   - Define strict Zod schemas for RAG answers, confidence ratings, and the 8-dimension comparison matrix with explicit claim-to-chunk ID mappings.
3. **Post-Generation Citation Verification**:
   - Verify every cited chunk actually contains textual evidence supporting the LLM statement; flag or remove ungrounded claims.
4. **Hardened Prompt-Injection Defense**:
   - Enclose document passages in hardened delimiters (`<document_evidence id="...">`) and instruct the model to treat internal text as untrusted data.

### Phase 4: Evaluation
1. **Benchmark Test Suite (`backend/eval/`)**:
   - Create 30–50 ground truth QA pairs based on `attention_is_all_you_need.pdf` and `lora_low_rank_adaptation.pdf`.
2. **Automated Evaluation Script**:
   - Compute retrieval Hit@K, MRR (Mean Reciprocal Rank), answer faithfulness, and citation accuracy.
   - Record baseline vs post-phase results in `docs/EVAL_RESULTS.md`.

### Phase 5: Product Features
1. **In-App PDF Viewer**:
   - Interactive PDF viewer modal that opens directly at the cited page and highlights the source excerpt.
2. **Markdown & PDF Export**:
   - 1-click export of comparison tables and Q&A chat transcripts to Markdown and formatted PDF.
3. **Collections & Projects**:
   - Organize research papers into named groups (e.g. "Attention Architectures", "Fine-Tuning").
4. **arXiv & DOI Direct Import**:
   - Provide an arXiv ID or DOI URL to fetch metadata and download the PDF automatically.
5. **Cross-Paper Contradictions View**:
   - Dedicated tab on `/compare` highlighting conflicting claims, differing benchmarks, or divergent conclusions between papers.

### Phase 6: Code Quality & Robustness
1. **Zod Environment Validation**:
   - Replace manual `process.env` parsing with a strict Zod config schema that fails immediately with clear error diagnostics if invalid.
2. **Security & Input Validation**:
   - Magic-byte validation for uploaded PDFs (`%PDF-`), filename sanitization, and request body validation on all Express routes.
3. **Database Performance**:
   - Compound MongoDB indexes on `Document` (`fileHash`, `status`, `createdAt`) and `DocumentChunk` (`documentId`, `chunkIndex`, `pageNumber`).
4. **Linting & Type Strictness**:
   - Clean up remaining oxlint warnings, configure ESLint + Prettier, and eliminate unchecked `any` types.

### Phase 7: Tests & Documentation
1. **Comprehensive Test Suite**:
   - Add unit and integration tests for hybrid retrieval, query rewriting, corrupt upload handling, and mocked comparison endpoints.
   - Frontend component tests with Vitest and React Testing Library.
2. **Production README Overhaul**:
   - Accurate feature documentation, Mermaid architecture diagrams, installation guide, and verified environment variables table.

---

## 3. Immediate Next Step

> [!IMPORTANT]
> In accordance with **STEP 0**, execution is paused here. Upon user approval, we will proceed immediately to **PHASE 1 - Retrieval Accuracy**.
