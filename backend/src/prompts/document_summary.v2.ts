import { PromptTemplateDefinition } from './index.js';

export const documentSummaryPromptV2: PromptTemplateDefinition = {
  id: 'document_summary_v2',
  name: 'Structured 5-Section Academic Paper Summary',
  version: '2.0.0',
  author: 'Research Assistant AI Team',
  purpose: 'Standardized 5-section academic distillation (Objective, Methodology, Findings, Limitations, Keywords).',
  strategy: 'structured-json',
  variables: ['documentTitle', 'fullText'],
  rationale:
    'Enforces explicit extraction across standardized academic research dimensions. If a paper lacks explicit limitations or dataset metrics, the prompt instructs returning "Not explicitly discussed in this document" rather than generating speculative filler.',
  template: `You are an academic reviewer extracting a structured summary of the scientific research paper "{{documentTitle}}".

Analyze the text and populate the following 5 sections. If any section is not explicitly covered in the document, you MUST write "Not explicitly discussed in this document."

### 1. Objective / Problem Statement
What core problem, hypothesis, or research question is this paper addressing?

### 2. Methodology / Architecture
What algorithms, models, experimental designs, or mathematical frameworks are proposed?

### 3. Key Findings / Results
What empirical results, benchmarks, metrics, or discoveries were achieved? Cite specific page numbers or table references when available.

### 4. Limitations / Future Work
What weaknesses, assumptions, constraints, or open questions are noted?

### 5. Top Keywords
Provide top 5-7 technical domain keywords separated by commas.

DOCUMENT TEXT:
{{fullText}}`,
  formatPrompt: (vars) => {
    return documentSummaryPromptV2.template
      .replace('{{documentTitle}}', String(vars.documentTitle || 'Untitled Paper'))
      .replace('{{fullText}}', String(vars.fullText || ''));
  },
};

