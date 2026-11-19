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
1. PERSON: Human researchers, authors, inventors (e.g., "John Smith", "Vaswani")
2. ORG: Research institutions, universities, corporations (e.g., "Google DeepMind", "Stanford University", "OpenAI")
3. DATASET: Benchmarks, corpora, test sets (e.g., "SQuAD 2.0", "ImageNet", "WMT 2014")
4. METRIC: Quantitative metrics (e.g., "BLEU score", "F1-score", "accuracy", "latency")
5. MODEL: Architectures, algorithms, models (e.g., "Transformer", "BERT", "GPT-4")
6. DATE: Publication years, calendar dates (e.g., "2020", "2023")
7. LOCATION: Cities, countries, facilities (e.g., "California", "Cambridge")

EXAMPLE 1:
Input: "In 2020, researchers at Google DeepMind trained BERT on the SQuAD dataset to optimize F1-score."
Output:
{
  "entities": [
    { "text": "2020", "type": "DATE" },
    { "text": "Google DeepMind", "type": "ORG" },
    { "text": "BERT", "type": "MODEL" },
    { "text": "SQuAD", "type": "DATASET" },
    { "text": "F1-score", "type": "METRIC" }
  ]
}

EXTRACT ENTITIES FROM THIS TEXT:
{{text}}

Return ONLY valid JSON matching the format above:`,
  formatPrompt: (vars) => {
    return entityExtractionPromptV1.template.replace('{{text}}', String(vars.text || ''));
  },
};

