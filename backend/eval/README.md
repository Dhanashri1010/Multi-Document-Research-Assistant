# NLP Course Benchmark Gold Datasets: Evaluator Audit & Review Guide

This directory contains the hand-labeled gold standard datasets used to compute empirical evaluation metrics (Accuracy, Macro Precision, Macro Recall, Macro F1, and 3x3 Confusion Matrices) for **Course Outcome 2 (CO2)** of the NLP Course Demonstration.

---

## 1. Sentiment Gold Dataset (`backend/eval/sentiment_gold.json`)

### File Format & Construction
Contains 52 balanced research and scientific sentences. Each entry has:
```json
{
  "id": 1,
  "text": "Our proposed transformer architecture achieves state-of-the-art accuracy of 92.4% on SQuAD v2.0.",
  "gold": "positive"
}
```

### Labeling Criteria
- **`positive`**: Sentences expressing breakthrough results, state-of-the-art accuracy, significant speedups, impressive memory reduction, or successful experimental validation.
- **`neutral`**: Factual statements describing experimental setups, parameters, datasets, numbers of GPUs, preprocessing steps, or architectural diagrams without emotional valence.
- **`negative`**: Sentences reporting failure modes, Out-Of-Memory crashes, high latency, prompt-injection vulnerabilities, hallucinations, severe bias, or catastrophic errors.

### Evaluation Metrics Calculated
1. **Accuracy**: Total correct predictions divided by 52 test sentences.
2. **Macro Precision**: Unweighted mean of precision across Positive, Neutral, and Negative classes.
3. **Macro Recall**: Unweighted mean of recall across Positive, Neutral, and Negative classes.
4. **Macro F1**: Harmonic mean of Macro Precision and Macro Recall:
   $$\text{Macro } F_1 = 2 \cdot \frac{\text{Macro Precision} \cdot \text{Macro Recall}}{\text{Macro Precision} + \text{Macro Recall}}$$
5. **3x3 Confusion Matrix**: Full distribution grid displaying True Positive, False Positive, and False Negative counts for each pairwise class transition.

---

## 2. Named Entity Recognition (NER) Gold Dataset (`backend/eval/entities_gold.json`)

### File Format & Construction
Contains 21 scientific passages annotated with ground-truth scientific entities:
```json
{
  "id": 1,
  "passage": "In 2020, researchers at Google DeepMind trained BERT on the SQuAD dataset to optimize F1-score.",
  "goldEntities": [
    { "text": "2020", "type": "DATE" },
    { "text": "Google DeepMind", "type": "ORG" },
    { "text": "BERT", "type": "MODEL" },
    { "text": "SQuAD", "type": "DATASET" },
    { "text": "F1-score", "type": "METRIC" }
  ]
}
```

### 7 Scientific Entity Types
- `PERSON`: Human researchers, authors, inventors (e.g. *Vaswani*, *LeCun*).
- `ORG`: Universities, corporations, institutes (e.g. *Google DeepMind*, *Stanford*, *MIT*).
- `DATASET`: Benchmarks, corpora, test sets (e.g. *SQuAD*, *GLUE*, *ImageNet*, *WMT 2014*).
- `METRIC`: Quantitative measurements (e.g. *Accuracy*, *F1-score*, *BLEU*, *Latency*).
- `MODEL`: Architectures and algorithms (e.g. *BERT*, *Transformer*, *GPT-4*, *BM25*).
- `DATE`: Publication years, calendar dates (e.g. *2024*, *2017*).
- `LOCATION`: Cities, countries, facilities (e.g. *California*, *Cambridge*).

### Exact vs. Partial Match Criteria
- **Exact Match**: The extracted entity text and type must match the gold annotation byte-for-byte:
  $$\text{Exact Match} \iff \text{text}_{\text{pred}} = \text{text}_{\text{gold}} \land \text{type}_{\text{pred}} = \text{type}_{\text{gold}}$$
- **Partial Match**: Requires matching entity type and a character/token Jaccard overlap $\ge 0.5$ between the predicted and gold boundaries.

---

## 3. Sample Documents Available for Live Viva
Located in `backend/eval/samples/`:
1. `sample_positive_sentiment_paper.txt`: Breakthrough paper reporting high accuracy and state-of-the-art benchmarks.
2. `sample_limitations_negative_paper.txt`: Critical paper discussing edge cases, memory limits, and security vulnerabilities.
3. `sample_multilingual_paper.txt`: Multilingual paper written in Marathi and Hindi discussing cross-lingual RAG and language identification.

---

## 4. How an External Evaluator Audits or Runs the Benchmarks
1. Open `backend/eval/sentiment_gold.json` or `entities_gold.json`.
2. Inspect or modify any label in a standard text editor.
3. In the live web UI at `/nlp-lab`, navigate to the **Evaluation Benchmark** tab.
4. Click **"Run Evaluation Benchmark"**.
5. The system dynamically executes the AFINN lexicon, rule-based NER, and Gemini models against the file, generating fresh confusion matrices and F1 scores in real time without hardcoding.
