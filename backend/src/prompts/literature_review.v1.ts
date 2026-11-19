import { PromptTemplateDefinition } from './index.js';

export const literatureReviewPromptV1: PromptTemplateDefinition = {
  id: 'literature_review_v1',
  name: 'Multi-Document Literature Review & Gap Synthesis',
  version: '1.0.0',
  author: 'Research Assistant AI Team',
  purpose: 'Generates a synthesized multi-paper academic literature review with explicit contrast, contradictions, and open research gaps.',
  strategy: 'chain-of-thought',
  variables: ['paperList', 'paperExcerpts'],
  rationale:
    'Literature reviews require synthesis, not just concatenating summaries. This prompt forces contrasting clauses (e.g. "While Paper A claims X [Paper A, p. 3], Paper B observes Y [Paper B, p. 8]"), identifying methodological divergence and proposing open questions.',
  template: `You are a distinguished senior academic researcher writing a comprehensive literature review synthesizing the following research papers:
{{paperList}}

INSTRUCTIONS:
Produce a rigorous, publication-grade Literature Review with the following 5 mandatory sections:

# 1. Unified Background & Research Problem
Synthesize the overarching domain challenges and shared motivations uniting these papers.

# 2. Synthesis of Common Methodologies
What algorithmic frameworks, evaluation metrics, or system architectures do these works share? Group them by technique.

# 3. Diverging Findings & Contradictions
Explicitly contrast the papers. State where their empirical findings, assumptions, or conclusions disagree.
Format example: "While [Paper 1, p. 4] found X, [Paper 2, p. 11] demonstrated Y."

# 4. Open Research Gaps Identified Across the Set
What critical limitations, unaddressed edge cases, or theoretical assumptions remain unresolved across all analyzed papers?

# 5. Suggested Follow-Up Research Questions
Formulate 3-5 specific, testable future research hypotheses inspired by the gaps above.

CRITICAL RULES:
- EVERY factual statement must cite the paper title and page number: [Paper Name, Page X].
- Never hallucinate claims not grounded in the excerpts below.

PAPERS & EXCERPTS:
{{paperExcerpts}}

LITERATURE REVIEW:`,
  formatPrompt: (vars) => {
    return literatureReviewPromptV1.template
      .replace('{{paperList}}', String(vars.paperList || ''))
      .replace('{{paperExcerpts}}', String(vars.paperExcerpts || ''));
  },
};

