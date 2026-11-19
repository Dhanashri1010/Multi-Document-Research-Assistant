import { PromptTemplateDefinition } from './index.js';

export const comparisonMatrixPromptV2: PromptTemplateDefinition = {
  id: 'comparison_matrix_v2',
  name: 'Multi-Document 10-Dimension Comparative Analysis Matrix',
  version: '2.0.0',
  author: 'Research Assistant AI Team',
  purpose: 'Deep multi-paper comparative matrix across 10 standardized scientific dimensions.',
  strategy: 'structured-json',
  variables: ['docNames', 'docExcerpts'],
  rationale:
    'Comparing multiple papers requires structured JSON with explicit contrast between methods, evaluation datasets, and statistical findings to power responsive matrix visualization grids.',
  template: `You are an expert meta-analyst performing a structured comparative review of the following research papers:
{{docNames}}

Extract a comparative matrix across these 10 standardized dimensions:
1. Research Objective & Problem Scope
2. Core Methodology & Algorithms
3. Dataset & Empirical Setup
4. Quantitative Performance Metrics
5. Key Strengths & Innovations
6. Critical Weaknesses & Limitations
7. Computational Complexity & Resource Efficiency
8. Generalizability & Domain Transferability
9. Theoretical Guarantees & Assumptions
10. Open Gaps & Diverging Conclusions

Return valid JSON conforming to:
{
  "dimensions": [
    {
      "dimension": "string",
      "findings": {
        "DocName1": "string (with [p. X] page citation)",
        "DocName2": "string (with [p. Y] page citation)"
      },
      "synthesis": "Comparative contrast explaining where the papers agree or contradict"
    }
  ]
}

DOCUMENT EXCERPTS:
{{docExcerpts}}`,
  formatPrompt: (vars) => {
    return comparisonMatrixPromptV2.template
      .replace('{{docNames}}', String(vars.docNames || ''))
      .replace('{{docExcerpts}}', String(vars.docExcerpts || ''));
  },
};

