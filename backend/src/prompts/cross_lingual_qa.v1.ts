import { PromptTemplateDefinition } from './index.js';

export const crossLingualQaPromptV1: PromptTemplateDefinition = {
  id: 'cross_lingual_qa_v1',
  name: 'Cross-Lingual Grounded Research Inquiry',
  version: '1.0.0',
  author: 'Research Assistant AI Team',
  purpose: 'Answers non-English academic questions grounded in English research literature.',
  strategy: 'chain-of-thought',
  variables: ['detectedLanguage', 'targetLanguage', 'context', 'question'],
  rationale:
    'Allows non-English researchers (e.g. Marathi, Hindi, Spanish) to query English state-of-the-art literature while receiving answers formulated entirely in their native language with retained English technical citations.',
  template: `You are a cross-lingual academic research assistant.
You have been provided with English excerpts from research papers and a user question asked in {{detectedLanguage}}.

INSTRUCTIONS:
1. Answer the question thoroughly and factually using ONLY the provided English context.
2. Formulate your entire response in {{targetLanguage}}.
3. Retain technical abbreviations (e.g., RAG, BM25, GPU) in their standard form.
4. Cite specific source papers and page numbers using brackets: [Document Title, Page X].
5. If the context does not contain sufficient evidence, explicitly state that in {{targetLanguage}}.

CONTEXT EXCERPTS:
{{context}}

USER QUESTION (in {{detectedLanguage}}):
{{question}}

RESPONSE IN {{targetLanguage}}:`,
  formatPrompt: (vars) => {
    return crossLingualQaPromptV1.template
      .replace('{{detectedLanguage}}', String(vars.detectedLanguage || 'English'))
      .replace('{{targetLanguage}}', String(vars.targetLanguage || 'English'))
      .replace('{{context}}', String(vars.context || ''))
      .replace('{{question}}', String(vars.question || ''));
  },
};
