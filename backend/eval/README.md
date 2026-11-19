# NLP Course Benchmark Gold Datasets: Review & Correction Guide

This directory contains the hand-labeled gold standard datasets used to compute empirical evaluation metrics (Accuracy, Macro Precision, Macro Recall, Macro F1, and 3x3 Confusion Matrices) for **Course Outcome 2 (CO2)**.

---

## 1. Sentiment Gold Dataset (`backend/eval/sentiment_gold.json`)

### File Format
Contains 52 balanced research and scientific sentences. Each entry has:
```json
{
  "id": 1,
  "text": "Our proposed transformer architecture achieves state-of-the-art accuracy of 92.4% on SQuAD v2.0.",
  "gold": "positive"
}
```

### Labeling Criteria
- **`positive`**: Sentences expressing breakthrough results, state-of-the-art accuracy, significant speedups, impressive memory reduction, or successful validation.
- **`neutral`**: Factual statements describing experimental setups, parameters, datasets, numbers of GPUs, preprocessing steps, or architectural diagrams without emotional valence.
- **`negative`**: Sentences reporting failure modes, Out-Of-Memory crashes, high latency, prompt-injection vulnerabilities, hallucinations, severe bias, or catastrophic errors.

### How to Review and Correct
1. Open `backend/eval/sentiment_gold.json`.
2. Inspect any sentence whose label you disagree with.
3. Change the `"gold"` field to `"positive"`, `"neutral"`, or `"negative"`.
4. Save the file.
5. In the UI under `/nlp-lab` -> **Evaluation Benchmark**, click **"Run Evaluation"** to re-compute the confusion matrices and metrics against your revised annotations.

---

## 2. Named Entity Recognition (NER) Gold Dataset (`backend/eval/entities_gold.json`)

### File Format
Contains 21 scientific passages annotated with ground-truth entities. Each entry has:
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

### Allowed Entity Types
- `PERSON`: Human researchers, authors, inventors (e.g. *John Smith*, *Alice Brown*).
- `ORG`: Universities, corporations, institutes, consortia (e.g. *Google DeepMind*, *Stanford*, *MIT*, *OpenAI*).
- `DATASET`: Benchmarks, corpora, test sets (e.g. *SQuAD*, *GLUE*, *ImageNet*, *MS MARCO*).
- `METRIC`: Quantitative evaluation measurements (e.g. *Accuracy*, *F1-score*, *BLEU*, *Perplexity*, *Latency*).
- `MODEL`: Architectures and algorithms (e.g. *BERT*, *Transformer*, *GPT-4*, *LLaMA*, *ResNet*).
- `DATE`: Publication years, calendar dates, months (e.g. *2024*, *2020*).
- `LOCATION`: Cities, countries, facilities (e.g. *California*, *Cambridge*).

### How to Review and Correct
1. Open `backend/eval/entities_gold.json`.
2. Check that the `"text"` field matches the substring in `"passage"` exactly.
3. Add or remove any entity tags that you consider valid or invalid.
4. Save the file and re-run evaluation in the web interface to view the updated exact and partial overlap F1 scores.

---

## 3. Strict Separation from Algorithms
None of the rule-based extractors, AFINN lexicons, or Gemini prompts have been tuned to or memorize these gold datasets. This guarantees that all metrics reported on the evaluation dashboard represent true, unbiased out-of-sample performance.

