import { PromptTemplateDefinition } from './index.js';

export const entityExtractionPromptV1: PromptTemplateDefinition = {
  id: 'entity_extraction_v1',
  name: 'Few-Shot Named Entity Recognition for Scientific Papers',
  version: '1.0.0',
  author: 'Research Assistant AI Team',
  purpose: 'Few-shot extraction of 7 scientific entity types with JSON schema enforcement.',
  strategy: 'few-shot',
  variables: ['text'],
  rationale:
    'Standard Spacy/NLTK NER models underperform on scientific papers (e.g. failing on algorithm names or dataset benchmarks). This few-shot prompt teaches the LLM the exact 7 entity definitions with positive/negative examples, outputting strict JSON.',
  template: `You are an expert scientific Named Entity Recognition (NER) model.
Extract entities belonging to these 7 categories:
1. METHOD: Algorithms, models, mathematical frameworks (e.g., "Transformer", "Adam optimizer", "BERT")
2. DATASET: Benchmarks, corpora, collections (e.g., "SQuAD 2.0", "ImageNet", "WMT 2014")
3. METRIC: Quantitative metrics (e.g., "BLEU score", "F1", "accuracy", "latency")
4. TASK: Problem domains or objectives (e.g., "machine translation", "question answering")
5. TOOL: Libraries, programming languages, platforms (e.g., "PyTorch", "Hugging Face", "CUDA")
6. RESEARCHER: Authors, scientists, research groups (e.g., "Vaswani et al.", "Google Brain")
7. HARDWARE: GPUs, TPUs, compute clusters (e.g., "NVIDIA A100", "TPU v3")

EXAMPLE 1:
Input: "We trained our Transformer model on 8 NVIDIA V100 GPUs using the WMT 2014 English-German dataset, achieving a 28.4 BLEU score."
Output:
{
  "entities": [
    { "text": "Transformer", "type": "METHOD" },
    { "text": "8 NVIDIA V100 GPUs", "type": "HARDWARE" },
    { "text": "WMT 2014 English-German", "type": "DATASET" },
    { "text": "28.4 BLEU", "type": "METRIC" }
  ]
}

EXTRACT ENTITIES FROM THIS TEXT:
{{text}}

Return ONLY valid JSON matching the format above:`,
  formatPrompt: (vars) => {
    return entityExtractionPromptV1.template.replace('{{text}}', String(vars.text || ''));
  },
};
