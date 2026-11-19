import { PromptTemplateDefinition } from './index.js';

export const topicNamingPromptV1: PromptTemplateDefinition = {
  id: 'topic_naming_v1',
  name: 'Semantic Topic Labeling from c-TF-IDF Clusters',
  version: '1.0.0',
  author: 'Research Assistant AI Team',
  purpose: 'Generates human-readable scientific topic names from c-TF-IDF keywords.',
  strategy: 'zero-shot',
  variables: ['clusters'],
  rationale:
    'Statistical keywords from c-TF-IDF (e.g. "retrieval, dense, query, passage") require contextual synthesis to produce descriptive titles (e.g. "Dense Passage Retrieval Architectures") for academic presentations.',
  template: `You are an expert NLP researcher specializing in topic modeling.
Given the following cluster IDs and their top c-TF-IDF keywords, generate a concise, professional 3-to-6 word title for each topic.

TOPIC CLUSTER KEYWORDS:
{{clusters}}

Format your response as valid JSON:
{
  "titles": {
    "1": "Descriptive Topic Title",
    "2": "Descriptive Topic Title"
  }
}
Return ONLY valid JSON:`,
  formatPrompt: (vars) => {
    return topicNamingPromptV1.template.replace('{{clusters}}', String(vars.clusters || ''));
  },
};
