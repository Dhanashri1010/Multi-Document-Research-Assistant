# Evaluation Results & Tracking

This document tracks empirical retrieval accuracy, grounded generation answer rates, and citation verification across all phases of the **Multi-Document Research Assistant**.

Generated automatically via `npm run eval` (`backend/eval/run_all_evals.ts`).

---

## 1. Corpus Audit: Real Academic Papers & Documents in Database

All 7 real research papers are fully parsed, chunked with section awareness, embedded with local `all-MiniLM-L6-v2` (384-dim), and stored in MongoDB:

| Document Original Name | Pages | Chunks | Status | Scanned / Density Status |
| :--- | :---: | :---: | :---: | :--- |
| `basic c programs.pdf` | 12 | 1 | `ready` | ⚠️ Warning: Low text density detected (averaging only 101 char... |
| `202502110005_Assignment5.pdf` | 8 | 7 | `ready` | ✓ Ready |
| `202502110005_DAA_Median.pdf` | 5 | 6 | `ready` | ✓ Ready |
| `Assignment 9.pdf` | 6 | 6 | `ready` | ✓ Ready |
| `DAA Assignment 7.pdf` | 6 | 3 | `ready` | ✓ Ready |
| `Flipped Classroom Activity.pdf` | 12 | 3 | `ready` | ✓ Ready |
| `Paper_21-Unmasking_AI_Generated_Texts.pdf` | 9 | 32 | `ready` | ✓ Ready |
| `Attention Is All You Need` | 15 | 36 | `ready` | ✓ Ready |
| `LoRA: Low-Rank Adaptation` | 26 | 66 | `ready` | ✓ Ready |
| `BERT: Pre-training of Deep Bidirectional Transfo` | 16 | 52 | `ready` | ✓ Ready |
| `Deep Residual Learning for Image Recognition` | 12 | 46 | `ready` | ✓ Ready |
| `Language Models are Few-Shot Learners` | 75 | 195 | `ready` | ✓ Ready |
| `Adam: A Method for Stochastic Optimization` | 15 | 38 | `ready` | ✓ Ready |
| `Unmasking AI-Generated Texts Using Linguistic an` | 9 | 32 | `ready` | ✓ Ready |

---

## 2. Retrieval Benchmark (Content-Based Hit Scoring)

> **Scoring Rule Change**: A retrieval **Hit** strictly requires that the retrieved chunk originates from the target paper and **contains the expected answer text (or labeled answer span / key entities)**. Exact page matches without the answer span no longer count as a hit.

### Split Comparison Table:

| Split | Total Queries | Grounded ($n$) | Hit@1 | Hit@3 | Hit@5 | MRR | Keyword Match @ 3 | Pre-LLM Refusal |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tuning Set** | 39 | 29 | **75.9%** | **86.2%** | **86.2%** | **0.810** | **86.2%** | **0%** |
| **Held-Out Set** | 36 | 31 | **80.6%** | **90.3%** | **90.3%** | **0.855** | **87.1%** | **0%** |
| **Overall** | 75 | 60 | **78.3%** | **88.3%** | **88.3%** | **0.833** | **86.7%** | **0%** |

### Category Breakdown (All 75 Queries):

| Category | Sample Size ($n$) | Hit@1 | Hit@3 | Hit@5 | MRR |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `single-doc` | 23 | 73.9% | 87.0% | 87.0% | 0.804 |
| `table` | 14 | 85.7% | 92.9% | 92.9% | 0.893 |
| `equation` | 9 | 100.0% | 100.0% | 100.0% | 1.000 |
| `paraphrased` | 7 | 57.1% | 71.4% | 71.4% | 0.643 |
| `multi-doc` | 7 | 71.4% | 85.7% | 85.7% | 0.786 |

---

## 3. Full Pipeline Grounded Answer Rate & Refusal

Grounded queries evaluated through the complete stack:
$$\text{Query} \longrightarrow \text{Hybrid Retrieval} \longrightarrow \text{Pre-LLM Cosine Gate} \longrightarrow \text{LLM Structured Synthesis} \longrightarrow \text{hasInsufficientEvidence} \longrightarrow \text{CitationVerifier}$$

| Split | Grounded Queries ($n$) | Real Answers Received | Wrongly Refused (False Refusals) | Answer Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Tuning Set** | 29 | 24 | 5 | **82.8%** |
| **Held-Out Set** | 31 | 26 | 5 | **83.9%** |
| **Overall Grounded** | 60 | 50 | 10 | **83.3%** |

---

## 4. Spot-Check Faithfulness Audit (10 Representative Answers)

Audited across 5 Tuning and 5 Held-Out answers spanning diverse categories:

| # | ID | Split | Category | Faithfulness Verdict | Question | Generated Answer Excerpt |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `q01` | `tuning` | `single-doc` | FAITHFUL (100%) | What BLEU score did the big Transformer achieve on the WMT 2014 Englis... | The model achieves a BLEU score of 28.4 on the WMT 2014 English-to-German translation task [Attentio... |
| 2 | `q08` | `tuning` | `single-doc` | UNFAITHFUL (0%) | How are matrices A and B initialized in LoRA at the start of training?... | In LoRA, matrix $A$ is initialized using a random Gaussian distribution ($A = \mathcal{N}(0, \sigma^... |
| 3 | `q13` | `tuning` | `table` | UNFAITHFUL (0%) | According to the translation benchmarks table, what is the training FL... | The provided research documents do not contain sufficient or complete evidence from the translation ... |
| 4 | `q21` | `tuning` | `equation` | UNFAITHFUL (0%) | How is the residual mapping building block mathematically formulated i... | ```json { "hasInsufficientEvidence": false, "insufficientReason": "", "answer": "In ResNet, instead ... |
| 5 | `q52` | `tuning` | `table` | UNFAITHFUL (0%) | What machine learning classifier achieved the highest accuracy on the ... | Based on the evaluation results using the custom dataset (as shown in Table VI), the machine learnin... |
| 6 | `q15` | `tuning` | `table` | UNFAITHFUL (0%) | From the BERT architecture configurations table, how many layers and h... | According to the BERT architecture configurations, **BERT-Large** has **24 layers** ($L=24$) and a h... |
| 7 | `q17` | `held-out` | `table` | FAITHFUL (100%) | According to the GPT-3 specifications table, how many layers, hidden d... | According to the GPT-3 specifications table (Table 2.1), GPT-3 175B has: - **Layers ($n_{ ext{layers... |
| 8 | `q22` | `tuning` | `equation` | UNFAITHFUL (0%) | What is the update equation for the exponential moving average of the ... | In Adam, the exponential moving average of the squared gradient $v_t$ is updated at timestep $t$ usi... |
| 9 | `q26` | `held-out` | `paraphrased` | UNFAITHFUL (0%) | What technique avoids catastrophic checkpoint explosion when deploying... | I am sorry, but the provided research documents do not contain evidence addressing this specific que... |
| 10 | `q57` | `held-out` | `table` | UNFAITHFUL (0%) | Which two machine learning models achieved 100% accuracy during the tr... | According to Table V in the provided research documents, the two machine learning models that achiev... |

---

## 5. CitationVerifier Benchmark (Tuning vs Held-Out Splits)

Evaluated against 40 hand-labeled claims (10 directly supported, 10 paraphrased, 10 completely unsupported, 10 altered numbers/metrics):

| Evaluation Set | Total Claims ($n$) | True Positives | True Negatives | False Positives | False Negatives | Accuracy | Precision | Recall | F1 Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tuning Set** (Calibrated) | 20 | 8 | 9 | 1 | 2 | **85.0%** | **88.9%** | **80.0%** | **0.842** |
| **Held-Out Set** (Frozen Blind) | 20 | 8 | 9 | 1 | 2 | **85.0%** | **88.9%** | **80.0%** | **0.842** |
| **Combined Overall** | 40 | 16 | 18 | 2 | 4 | **85.0%** | **88.9%** | **80.0%** | **0.842** |

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

---

## 7. Failed Grounded Retrieval Queries & Inspection (Retrieved Chunks)

### Query [q06] (`tuning`, `single-doc`)
**Question**: "Who are the authors of the paper Attention Is All You Need and their affiliation?"

**Top-5 Retrieved Chunks**:
- **#1** [`Language Models are Few-Shot Learners`, p.1, score: 0.031]: "with tasks and few-shot demonstrations specified purely via text interaction with the model. GPT-3 arXiv:2005.14165v4 [cs.CL] 22 Jul 2020 ac"
- **#2** [`Attention Is All You Need`, p.7, score: 0.03]: "path length to O ( n/r ) A single convolutional layer with kernel width positions. Doing so requires a stack of O ( n/k ) or O ( log k ( n )"
- **#3** [`Attention Is All You Need`, p.14, score: 0.029]: "<EOS> <pad> , . is in this we are my what <pad> missing opinion <EOS> Input-Input Layer5 The Law will never be perfect , but its application"
- **#4** [`Attention Is All You Need`, p.5, score: 0.029]: "d k = d v = d model /h = 64 is similar to that of single-head attention with full dimensionality. 3.2.3 Applications of Attention in our Mod"
- **#5** [`Language Models are Few-Shot Learners`, p.48, score: 0.026]: "Model generation selection methods, exclusion criteria, and statistical tests mirror those of the previous experiments. F Additional Samples"

### Query [q08] (`tuning`, `single-doc`)
**Question**: "How are matrices A and B initialized in LoRA at the start of training?"

**Top-5 Retrieved Chunks**:
- **#1** [`LoRA: Low-Rank Adaptation`, p.4, score: 0.034]: "For a pre-trained , we constrain its update by representing the latter with a low-rank ded × r r × k ∈ R ,A ∈ R , and the rank r min( d,k ) "
- **#2** [`LoRA: Low-Rank Adaptation`, p.2, score: 0.033]: "y i are sequences of tokens. For example, in NL2SQL, corresponding SQL command; for summarization, r in Figure 1 can be one or two) suffices"
- **#3** [`LoRA: Low-Rank Adaptation`, p.1, score: 0.032]: "https://github.com/microsoft/LoRA . f(x) multiple down- h fine-tuning , Pretrained 퐵 = 0 Pretrained Weights Weights 푟 푑 × 푑 푊 ∈ ℝ 푑 × 푑 푊 ∈ "
- **#4** [`BERT: Pre-training of Deep Bidirectional Transformers`, p.3, score: 0.029]: "There are two steps in our framework: pre-training and fine-tuning . During pre-training, the model is trained on unlabeled data over differ"
- **#5** [`Adam: A Method for Stochastic Optimization`, p.3, score: 0.021]: "3 I NITIALIZATION BIAS CORRECTION As explained in section 2, Adam utilizes initialization bias correction terms. We will here derive the ter"

### Query [q25] (`tuning`, `paraphrased`)
**Question**: "Why does processing long documents create a memory bottleneck for early transformer architectures?"

**Top-5 Retrieved Chunks**:
- **#1** [`LoRA: Low-Rank Adaptation`, p.5, score: 0.035]: "model by construction. 4.2 A PPLYING L O RA TO T RANSFORMER In principle, we can apply LoRA to any subset of weight matrices in a neural net"
- **#2** [`LoRA: Low-Rank Adaptation`, p.3, score: 0.031]: "et al., 2019; Rebuffi et al., 2017; Pfeiffer et al., 2021; R of the input layer activations (Li & Liang, 2021; Lester et al., 2021; Hambardz"
- **#3** [`Language Models are Few-Shot Learners`, p.39, score: 0.029]: "downstream tasks across 3 orders of magnitude of scaling. Another line of work goes in the opposite direction from scaling, attempting to pr"
- **#4** [`Language Models are Few-Shot Learners`, p.8, score: 0.03]: "Model Name n params n layers d GPT-3 Small 125M 12 768 GPT-3 Medium 350M 24 1024 GPT-3 Large 760M 24 1536 GPT-3 XL 1.3B 24 2048 GPT-3 2.7B 2"
- **#5** [`Attention Is All You Need`, p.2, score: 0.027]: "1 Introduction Recurrent neural networks, long short-term memory [ 13 ] and gated recurrent [ 7 ] neural networks in particular, have been f"

### Query [q26] (`held-out`, `paraphrased`)
**Question**: "What technique avoids catastrophic checkpoint explosion when deploying dozens of task-adapted language models?"

**Top-5 Retrieved Chunks**:
- **#1** [`Language Models are Few-Shot Learners`, p.35, score: 0.035]: "not immediate, but significant improvements in reliability could change this. Because APTs do not typically discuss operations in the open, "
- **#2** [`Attention Is All You Need`, p.8, score: 0.031]: "Training took surpasses all previously published models and ensembles, at a fraction of the training cost of any of the competitive models. "
- **#3** [`Language Models are Few-Shot Learners`, p.35, score: 0.032]: "Many of these applications bottleneck on human beings to write sufficiently high quality text. Language models that produce high quality tex"
- **#4** [`Language Models are Few-Shot Learners`, p.39, score: 0.031]: "downstream tasks across 3 orders of magnitude of scaling. Another line of work goes in the opposite direction from scaling, attempting to pr"
- **#5** [`LoRA: Low-Rank Adaptation`, p.1, score: 0.029]: "DeBERTa, and GPT-2 at 1 I NTRODUCTION Many applications in natural language processing rely on adapting one large-scale, pre-trained languag"

### Query [q33] (`tuning`, `multi-doc`)
**Question**: "How do the training durations and hardware footprints compare between the original Transformer and GPT-3 175B?"

**Top-5 Retrieved Chunks**:
- **#1** [`LoRA: Low-Rank Adaptation`, p.9, score: 0.035]: "Training larger Transformers generally results in better performance and remains an active research direction. GPT-3 (Brown et al., 2020) is"
- **#2** [`LoRA: Low-Rank Adaptation`, p.5, score: 0.031]: "We also observe a 25% speedup during training on GPT-3 175B compared to full fine-tuning gradient for the vast majority of the parameters. w"
- **#3** [`Language Models are Few-Shot Learners`, p.8, score: 0.031]: "Model Name n params n layers d GPT-3 Small 125M 12 768 GPT-3 Medium 350M 24 1024 GPT-3 Large 760M 24 1536 GPT-3 XL 1.3B 24 2048 GPT-3 2.7B 2"
- **#4** [`LoRA: Low-Rank Adaptation`, p.16, score: 0.029]: "model performance drastically compared to few-shot learning on datasets large and small. We take the GPT-3 few-shot result on RTE from the G"
- **#5** [`Language Models are Few-Shot Learners`, p.30, score: 0.028]: "completion are provided by a human; this then serves as conditioning for subsequent examples where GPT-3 receives successive additional prom"

### Query [q61] (`held-out`, `table`)
**Question**: "What total word count and breakdown of AI-generated versus human-written records were obtained after cleaning in the AI text detection dataset?"

**Top-5 Retrieved Chunks**:
- **#1** [`Unmasking AI-Generated Texts Using Linguistic and Stylistic Features`, p.2, score: 0.034]: "model of origin; and (3) Mixed - Model Multiclass AIGT lower scores overall, with Copyleaks being the best at spottin g Detection, wh ere th"
- **#2** [`Unmasking AI-Generated Texts Using Linguistic and Stylistic Features`, p.7, score: 0.033]: "On ly the scores for SVM were low. The eva luation process is driven by a custom dataset that has been created to match the need of this stu"
- **#3** [`Unmasking AI-Generated Texts Using Linguistic and Stylistic Features`, p.3, score: 0.034]: "Fast - DetectGPT uses a novel three step procedure: 1) Sample – basic AI - generated, basic AI - rephrased, adv anced AI - generates alterna"
- **#4** [`Language Models are Few-Shot Learners`, p.45, score: 0.027]: "Overlap statistics for all datasets sorted from dirtiest to cleanest. We consider a dataset example dirty if it -gram collision with any doc"
- **#5** [`Language Models are Few-Shot Learners`, p.46, score: 0.026]: "failing an internet check question, leaving a total of 621 participants: 343 male, 271 female, and 7 other. Mean years old. All participants"

### Query [q74] (`held-out`, `single-doc`)
**Question**: "Why does the Adam optimizer require bias-correction terms for the first and second moment vectors?"

**Top-5 Retrieved Chunks**:
- **#1** [`Adam: A Method for Stochastic Optimization`, p.3, score: 0.035]: "3 I NITIALIZATION BIAS CORRECTION As explained in section 2, Adam utilizes initialization bias correction terms. We will here derive the ter"
- **#2** [`Adam: A Method for Stochastic Optimization`, p.5, score: 0.035]: "preconditioner that adapts to the geometry of the data, since of the Fisher information matrix (Pascanu & Bengio, 2013); however, Adam’s pre"
- **#3** [`Adam: A Method for Stochastic Optimization`, p.7, score: 0.034]: "hand picking manually as in SGD. (b) Figure 2: Training of multilayer neural networks on MNIST images. (a) Neural networks using CIFAR10 Con"
- **#4** [`BERT: Pre-training of Deep Bidirectional Transformers`, p.13, score: 0.023]: "Lstm E 1 E 2 ... E N Figure 3: Differences in pre-training model architectures. BERT uses a bidirectional Transformer. OpenAI GPT epochs ove"
- **#5** [`Language Models are Few-Shot Learners`, p.43, score: 0.022]: "Appendix C. B Details of Model Training − 8 To train all versions of GPT-3, we use Adam with β 1 = 0.9 , β 2 = 0.95 , and = 10 , we clip the"
