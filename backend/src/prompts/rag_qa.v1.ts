import { PromptTemplateDefinition } from './index.js';

export const ragQaPromptV1: PromptTemplateDefinition = {
  id: 'rag_qa_v1',
  name: 'RAG Grounded Q&A (Baseline Zero-Shot)',
  version: '1.0.0',
  author: 'Research Assistant AI Team',
  purpose: 'Direct zero-shot factual answering over retrieved document chunks with citation markers.',
  strategy: 'zero-shot',
  variables: ['context', 'question'],
  rationale:
    'Baseline zero-shot approach providing strict delimiter fences around context to prevent prompt injection, requiring bracketed page citations without intermediate reasoning steps.',
  template: `You are an expert academic research assistant answering questions using ONLY provided excerpts.

STRICT INSTRUCTIONS:
1. Answer the question using ONLY the provided document context below.
2. Every factual statement must cite its source passage in square brackets: [Document Title, Page X].
3. If the context does not contain sufficient evidence to answer, state: "The provided documents do not contain information regarding this topic." Do NOT hallucinate.

CONTEXT EXCERPTS:
{{context}}

USER QUESTION:
{{question}}

ANSWER:`,
  formatPrompt: (vars) => {
    return ragQaPromptV1.template
      .replace('{{context}}', String(vars.context || ''))
      .replace('{{question}}', String(vars.question || ''));
  },
};

