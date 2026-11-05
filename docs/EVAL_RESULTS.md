# Evaluation Results & Tracking

This document tracks the retrieval and generation accuracy across development phases of the **Multi-Document Research Assistant**.

Evaluation is performed automatically via the expanded evaluation harness (`backend/eval/evaluate.ts`), which benchmarks retrieval across an active corpus of **6 realistic academic research papers** in `samples/`:
1. `attention_is_all_you_need.pdf` (Transformer architecture)
2. `lora_low_rank_adaptation.pdf` (LoRA parameter-efficient adaptation)
3. `bert_pretraining_deep_bidirectional.pdf` (BERT bidirectional pre-training)
4. `resnet_deep_residual_learning.pdf` (ResNet deep residual learning)
5. `gpt3_language_models_few_shot.pdf` (GPT-3 few-shot scaling)
6. `adam_stochastic_optimization.pdf` (Adam stochastic optimization)

The benchmark dataset (`backend/eval/dataset.json`) contains **42 rigorous evaluation queries** covering:
- **Single-document factual queries** (N=12)
- **Table-specific queries** (N=6)
- **Mathematical equation & formula queries** (N=6)
- **Paraphrased / Semantic Gap queries** with wording differing from the source text (N=6)
- **Multi-document cross-paper comparison queries** (N=6)
- **Off-topic distractor queries** requiring insufficient-evidence refusal (N=6)

---

## Metric Definitions

- **Hit@k**: Proportion of grounded queries where at least one chunk from the ground-truth target document and page is retrieved within top $k$.
- **MRR (Mean Reciprocal Rank)**: $\frac{1}{|Q_{\text{rel}}|} \sum_{i=1}^{|Q_{\text{rel}}|} \frac{1}{\text{rank}_i}$, where $\text{rank}_i$ is the position of the first ground-truth relevant chunk.
- **Keyword Match @ 3**: Proportion of grounded queries where the top 3 retrieved chunks contain required technical answer phrases.
- **Off-Topic Refusal Accuracy**: Proportion of completely unrelated/off-topic questions that are successfully recognized and refused with zero false-positive chunks at standard confidence threshold.
- **Answer Faithfulness**: Proportion of generated statements supported by retrieved context (evaluated in Phase 3/4).

---

## Progression Summary (Expanded 42-Query Benchmark)

| Phase | Description | Hit@1 | Hit@3 | Hit@5 | MRR | Keyword Match @ 3 | Off-Topic Refusal | Date |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Phase 1 Baseline** | BM25 + Dense RRF on 6-Paper Corpus (42 Qs) | **94.4%** | **94.4%** | **94.4%** | **0.944** | **83.3%** | **33.3%** | Nov 6, 2026 |
| **Phase 2** | Ingestion Quality (2-Column parsing, Headings) | TBD | TBD | TBD | TBD | TBD | TBD | Pending |
| **Phase 3** | Grounded Generation (Zod, Citations, Refusals) | TBD | TBD | TBD | TBD | TBD | TBD | Pending |
| **Phase 4** | Advanced Eval (Faithfulness & Citation Audit) | TBD | TBD | TBD | TBD | TBD | TBD | Pending |

---

## Detailed Run History

### Run 1: Expanded 42-Query Benchmark on Phase 1 Pipeline
- **Date**: 2026-11-06
- **Dataset**: `backend/eval/dataset.json` (42 items: 36 grounded + 6 off-topic)
- **Corpus**: 6 indexed academic papers in MongoDB with distractor papers (`attention`, `lora`, `bert`, `resnet`, `gpt3`, `adam`).
- **Configuration**:
  - Retrieval: Local BM25 + Float32Array Dense RRF ($k=60$)
  - Balanced multi-document quota allocation
  - MMR ($\lambda = 0.7$, duplicate threshold 0.98)
  - Reranker: `off`
- **Global Metrics**:
  - Total Queries: **42** (36 grounded, 6 off-topic)
  - **Hit@1**: **94.4%** (34 / 36)
  - **Hit@3**: **94.4%** (34 / 36)
  - **Hit@5**: **94.4%** (34 / 36)
  - **MRR (Mean Reciprocal Rank)**: **0.944**
  - **Keyword Match @ 3**: **83.3%** (30 / 36)
  - **Off-Topic Refusal**: **33.3%** (2 / 6 refused at `minScore: 0.22`)
- **Category Breakdown**:
  - `table` (N=6): **Hit@1 = 100% | Hit@3 = 100% | Hit@5 = 100% | MRR = 1.000**
  - `equation` (N=6): **Hit@1 = 100% | Hit@3 = 100% | Hit@5 = 100% | MRR = 1.000**
  - `paraphrased` (N=6): **Hit@1 = 100% | Hit@3 = 100% | Hit@5 = 100% | MRR = 1.000**
  - `multi-doc` (N=6): **Hit@1 = 100% | Hit@3 = 100% | Hit@5 = 100% | MRR = 1.000**
  - `single-doc` (N=12): **Hit@1 = 83.3% | Hit@3 = 83.3% | Hit@5 = 83.3% | MRR = 0.833**
- **Analysis & Targets for Phase 2**:
  1. `table`, `equation`, `paraphrased`, and `multi-doc` achieve **100% Hit@1 and 1.0 MRR**.
  2. In `single-doc`, `q08` (LoRA matrix initialization) and `q11` (BERT MLM pre-training objectives) were missed because chunk boundary cuts in the initial PDF parsing split the section headers from the explanatory text. Phase 2's column-aware extraction and section-aware chunking will address this.
  3. Off-topic refusal is currently 33.3% based on pure embedding cosine thresholds without section-level validation or LLM insufficient-evidence gates (targeted in Phase 2/3).
