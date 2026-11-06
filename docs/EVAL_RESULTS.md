# Evaluation Results & Tracking

This document tracks empirical retrieval accuracy, grounded generation answer rates, and citation verification across all phases of the **Multi-Document Research Assistant**.

Generated automatically via `npm run eval` (`backend/eval/run_all_evals.ts`).

---

## 1. Corpus Audit: Real Academic Papers & Documents in Database

All 7 real research papers are fully parsed, chunked with section awareness, embedded with local `all-MiniLM-L6-v2` (384-dim), and stored in MongoDB:

| Document Original Name | Pages | Chunks | Status | Scanned / Density Status |
| :--- | :---: | :---: | :---: | :--- |
| `basic c programs.pdf` | 12 | 2 | `ready` | ⚠️ Warning: Low text density detected (averaging only 101 char... |
| `202502110005_Assignment5.pdf` | 8 | 11 | `ready` | ✓ Ready |
| `202502110005_DAA_Median.pdf` | 5 | 10 | `ready` | ✓ Ready |
| `Assignment 9.pdf` | 6 | 9 | `ready` | ✓ Ready |
| `DAA Assignment 7.pdf` | 6 | 5 | `ready` | ✓ Ready |
| `Flipped Classroom Activity.pdf` | 12 | 6 | `ready` | ✓ Ready |
| `Paper_21-Unmasking_AI_Generated_Texts.pdf` | 9 | 54 | `ready` | ✓ Ready |
| `Attention Is All You Need` | 15 | 57 | `ready` | ✓ Ready |
| `LoRA: Low-Rank Adaptation` | 26 | 118 | `ready` | ✓ Ready |
| `BERT: Pre-training of Deep Bidirectional Transfo` | 16 | 86 | `ready` | ✓ Ready |
| `Deep Residual Learning for Image Recognition` | 12 | 82 | `ready` | ✓ Ready |
| `Language Models are Few-Shot Learners` | 75 | 323 | `ready` | ✓ Ready |
| `Adam: A Method for Stochastic Optimization` | 15 | 66 | `ready` | ✓ Ready |
| `Unmasking AI-Generated Texts Using Linguistic an` | 9 | 54 | `ready` | ✓ Ready |

---

## 2. Retrieval Benchmark (Content-Based Hit Scoring)

> **Scoring Rule Change**: A retrieval **Hit** strictly requires that the retrieved chunk originates from the target paper and **contains the expected answer text (or labeled answer span / key entities)**. Exact page matches without the answer span no longer count as a hit.

### Split Comparison Table:

| Split | Total Queries | Grounded ($n$) | Hit@1 | Hit@3 | Hit@5 | MRR | Keyword Match @ 3 | Pre-LLM Refusal |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tuning Set** | 39 | 29 | **51.7%** | **72.4%** | **72.4%** | **0.621** | **69%** | **0%** |
| **Held-Out Set** | 21 | 16 | **56.3%** | **62.5%** | **68.8%** | **0.609** | **62.5%** | **0%** |
| **Overall** | 60 | 45 | **53.3%** | **68.9%** | **71.1%** | **0.617** | **66.7%** | **0%** |

### Category Breakdown (All 60 Queries):

| Category | Sample Size ($n$) | Hit@1 | Hit@3 | Hit@5 | MRR |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `single-doc` | 15 | 46.7% | 66.7% | 73.3% | 0.583 |
| `table` | 11 | 81.8% | 81.8% | 81.8% | 0.818 |
| `equation` | 6 | 0.0% | 33.3% | 33.3% | 0.167 |
| `paraphrased` | 7 | 42.9% | 71.4% | 71.4% | 0.571 |
| `multi-doc` | 6 | 83.3% | 83.3% | 83.3% | 0.833 |

---

## 3. Full Pipeline Grounded Answer Rate & Refusal

Grounded queries evaluated through the complete stack:
$$\text{Query} \longrightarrow \text{Hybrid Retrieval} \longrightarrow \text{Pre-LLM Cosine Gate} \longrightarrow \text{LLM Structured Synthesis} \longrightarrow \text{hasInsufficientEvidence} \longrightarrow \text{CitationVerifier}$$

| Split | Grounded Queries ($n$) | Real Answers Received | Wrongly Refused (False Refusals) | Answer Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Tuning Set** | 29 | 24 | 5 | **82.8%** |
| **Held-Out Set** | 16 | 12 | 4 | **75%** |
| **Overall Grounded** | 45 | 36 | 9 | **80%** |

---

## 4. Spot-Check Faithfulness Audit (10 Representative Answers)

Audited across 5 Tuning and 5 Held-Out answers spanning diverse categories:

| # | ID | Split | Category | Faithfulness Verdict | Question | Generated Answer Excerpt |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `q01` | `tuning` | `single-doc` | FAITHFUL (100%) | What BLEU score did the big Transformer achieve on the WMT 2014 Englis... | The Transformer model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task [Attenti... |
| 2 | `q08` | `tuning` | `single-doc` | FAITHFUL (100%) | How are matrices A and B initialized in LoRA at the start of training?... | According to the provided document for LoRA, matrix $A$ is initialized with a random Gaussian distri... |
| 3 | `q13` | `tuning` | `table` | FAITHFUL (100%) | According to the translation benchmarks table, what is the training FL... | The provided research documents do not contain evidence addressing the training FLOPs comparison for... |
| 4 | `q21` | `tuning` | `equation` | PARTIALLY_SUPPORTED (76%) | How is the residual mapping building block mathematically formulated i... | **Evidence Retrieved (6 passages found):** *Note: LLM generative synthesis is currently unavailable ... |
| 5 | `q52` | `tuning` | `table` | UNFAITHFUL (0%) | What machine learning classifier achieved the highest accuracy on the ... | In the AI-generated text study, the Random Forest model achieved the highest accuracy on the custom ... |
| 6 | `q15` | `tuning` | `table` | UNFAITHFUL (0%) | From the BERT architecture configurations table, how many layers and h... | According to the BERT model architecture configurations, BERT-Large has 24 layers and a hidden dimen... |
| 7 | `q17` | `held-out` | `table` | PARTIALLY_SUPPORTED (60%) | According to the GPT-3 specifications table, how many layers, hidden d... | **Evidence Retrieved (6 passages found):** *Note: LLM generative synthesis is currently unavailable ... |
| 8 | `q22` | `tuning` | `equation` | PARTIALLY_SUPPORTED (68%) | What is the update equation for the exponential moving average of the ... | **Evidence Retrieved (6 passages found):** *Note: LLM generative synthesis is currently unavailable ... |
| 9 | `q26` | `held-out` | `paraphrased` | UNFAITHFUL (31%) | What technique avoids catastrophic checkpoint explosion when deploying... | **Evidence Retrieved (6 passages found):** *Note: LLM generative synthesis is currently unavailable ... |
| 10 | `q57` | `held-out` | `table` | PARTIALLY_SUPPORTED (50%) | Which two machine learning models achieved 100% accuracy during the tr... | According to Table V in the provided studies, the two machine learning models that achieved 100% acc... |

---

## 5. CitationVerifier Benchmark (Tuning vs Held-Out Splits)

Evaluated against 40 hand-labeled claims (10 directly supported, 10 paraphrased, 10 completely unsupported, 10 altered numbers/metrics):

| Evaluation Set | Total Claims ($n$) | True Positives | True Negatives | False Positives | False Negatives | Accuracy | Precision | Recall | F1 Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tuning Set** (Calibrated) | 20 | 10 | 9 | 1 | 0 | **95.0%** | **90.9%** | **100.0%** | **0.952** |
| **Held-Out Set** (Frozen Blind) | 20 | 5 | 9 | 1 | 5 | **70.0%** | **83.3%** | **50.0%** | **0.625** |
| **Combined Overall** | 40 | 15 | 18 | 2 | 5 | **82.5%** | **88.2%** | **75.0%** | **0.811** |

---

## 6. Scanned-PDF Rule Diagnostic & Policy

1. **Hard Rejection Policy**:
   - Only triggered when machine-readable text is virtually absent: $\text{totalChars} < 50$ or $\text{avgCharsPerPage} < 20$.
   - Returns a clear error informing the user that OCR is required.
2. **Soft Warning Policy (Borderline Cases)**:
   - If $\text{totalPages} \ge 3$ and $\text{avgCharsPerPage} < 120$ (e.g. presentation slides with single-line titles like `basic c programs.pdf`, 101 chars/page):
   - The document is **successfully ingested and set to `ready`**, but carries an amber warning flag:
     *`Low text density detected (averaging X chars/page). Core content may be in embedded slide images; OCR recommended.`*
   - Surfaces in the frontend UI as an informative badge.
