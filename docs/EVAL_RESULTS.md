# Evaluation Results & Tracking

This document tracks the retrieval and generation accuracy across development phases of the **Multi-Document Research Assistant**.

Evaluation is performed automatically via the evaluation harness (`backend/eval/evaluate.ts`), which benchmarks retrieval over real indexed research papers from `samples/` (`attention_is_all_you_need.pdf` and `lora_low_rank_adaptation.pdf`).

---

## Metric Definitions

- **Hit@k**: Proportion of queries where at least one chunk from the ground-truth target page is retrieved within top $k$.
- **MRR (Mean Reciprocal Rank)**: $\frac{1}{|Q|} \sum_{i=1}^{|Q|} \frac{1}{\text{rank}_i}$, where $\text{rank}_i$ is the position of the first ground-truth relevant chunk.
- **Keyword Match @ 3**: Proportion of queries where the top 3 retrieved chunks contain the required technical answer keywords.
- **Answer Faithfulness**: Proportion of generated statements supported by retrieved context (evaluated in Phase 4).
- **Citation Precision**: Proportion of citations that directly support the referenced claim (evaluated in Phase 4).

---

## Progression Summary

| Phase | Description | Hit@1 | Hit@3 | Hit@5 | MRR | Keyword Match @ 3 | Date |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Baseline** | Initial pure vector cosine + keyword bonus | **94.4%** | **94.4%** | **94.4%** | **0.944** | **88.9%** | Nov 5, 2026 |
| **Phase 1** | BM25 + Dense RRF, MMR, Multi-doc Quota | **94.4%** | **100.0%** | **100.0%** | **0.972** | **88.9%** | Nov 5, 2026 |
| **Phase 2** | Ingestion Quality (2-column PDF, headings) | TBD | TBD | TBD | TBD | TBD | Pending |
| **Phase 3** | Grounded Generation (Zod, Citation verif.) | TBD | TBD | TBD | TBD | TBD | Pending |
| **Phase 4** | Expanded Eval (30-50 QAs + Faithfulness) | TBD | TBD | TBD | TBD | TBD | Pending |

---

## Detailed Run History

### Run 0: Baseline (Pre-Phase 1)
- **Date**: 2026-11-05
- **Dataset**: `backend/eval/dataset.json` (18 ground-truth academic Q&A items across Transformer and LoRA papers)
- **Configuration**:
  - Retrieval: Pure vector cosine + keyword bonus
  - Reranker: `off`
  - MMR: Disabled
  - Corpus: `attention_is_all_you_need.pdf`, `lora_low_rank_adaptation.pdf`
- **Results**:
  - Total Queries: 18
  - Hit@1: **17 / 18 (94.4%)**
  - Hit@3: **17 / 18 (94.4%)**
  - Hit@5: **17 / 18 (94.4%)**
  - Mean Reciprocal Rank (MRR): **0.944**
  - Keyword Match @ 3: **16 / 18 (88.9%)**
- **Analysis of Failures / Boundary Cases**:
  - `q11` (*"How are matrices A and B initialized in LoRA at the start of training?"*): Ground truth on Page 4. Retrieved chunk rank was > 5 because the Section 4.1 text was split across chunk boundaries without section header metadata, diluting the cosine similarity score. Target for Phase 1 (BM25 weighting) and Phase 2 (section-aware chunking).

---

### Run 1: Phase 1 - Retrieval Accuracy Overhaul
- **Date**: 2026-11-05
- **Dataset**: `backend/eval/dataset.json` (18 ground-truth academic Q&A items)
- **Implemented Upgrades**:
  1. **BM25 + Dense RRF**: Okapi BM25 lexical ranking combined with Float32Array dense cosine similarity via Reciprocal Rank Fusion ($k=60$) with dense similarity tiebreaker.
  2. **Model & Dimension Enforcement**: Chunks embedded with differing models or vector dimensions are strictly excluded from retrieval, preventing cross-model space pollution.
  3. **Balanced Multi-Document Retrieval**: Implemented proportional document quota allocation and balance filtering to ensure one paper cannot dominate multi-document answers.
  4. **Maximal Marginal Relevance (MMR)**: Prunes near-duplicate chunks ($\text{sim} > 0.98$) and ensures passage diversity ($\lambda = 0.7$).
  5. **IVectorStore Polymorphism**: Created `IVectorStore` interface with `LocalVectorStore` and `AtlasVectorStore` implementations and backward-compatible `VectorStore` facade.
  6. **Reranker Pipeline**: Structured two-stage retrieval pipeline (retrieve 20–30 candidates, rerank to 5–6) with configurable `RERANKER=on|off` and transparent no-op fallback.
- **Results**:
  - Total Queries: 18
  - Hit@1: **17 / 18 (94.4%)**
  - Hit@3: **18 / 18 (100.0%)** *(+5.6% improvement)*
  - Hit@5: **18 / 18 (100.0%)** *(+5.6% improvement)*
  - Mean Reciprocal Rank (MRR): **0.972** *(+0.028 improvement)*
  - Keyword Match @ 3: **16 / 18 (88.9%)**
- **Analysis**:
  - The previous baseline failure on query `q11` (*"How are matrices A and B initialized in LoRA at the start of training?"*) was completely resolved: it moved from being unretrieved in top 5 to **Rank #2**, bringing both **Hit@3 and Hit@5 to 100%**.
  - All 18 benchmark queries retrieved ground-truth target pages within the top 3 results.
