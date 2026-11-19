export type PromptStrategy = 'zero-shot' | 'few-shot' | 'chain-of-thought' | 'structured-json';

export interface PromptTemplateDefinition {
  id: string;
  name: string;
  version: string;
  author: string;
  purpose: string;
  strategy: PromptStrategy;
  variables: string[];
  rationale: string;
  template: string;
  formatPrompt: (vars: Record<string, string | number>) => string;
}

export * from './rag_qa.v1.js';
export * from './rag_qa.v2.js';
export * from './document_summary.v2.js';
export * from './comparison_matrix.v2.js';
export * from './entity_extraction.v1.js';
export * from './topic_naming.v1.js';
export * from './cross_lingual_qa.v1.js';
export * from './literature_review.v1.js';
