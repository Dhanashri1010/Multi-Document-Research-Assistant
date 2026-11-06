import { CitationVerifier } from '../src/services/ai/citationVerifier.ts';

export interface LabeledTestCase {
  id: string;
  category: 'supported' | 'paraphrased' | 'unsupported' | 'wrong_number';
  split: 'tuning' | 'held-out';
  expectedSupported: boolean;
  claim: string;
  chunk: string;
}

export const tuningTestCases: LabeledTestCase[] = [
  // 1-5: Directly Supported
  {
    id: 's01',
    category: 'supported',
    split: 'tuning',
    expectedSupported: true,
    claim: 'The Transformer model achieved a BLEU score of 28.4 on the WMT 2014 English-to-German translation benchmark.',
    chunk: 'On the WMT 2014 English-to-German translation task, the big transformer model achieves a BLEU score of 28.4, outperforming the existing best results.',
  },
  {
    id: 's02',
    category: 'supported',
    split: 'tuning',
    expectedSupported: true,
    claim: 'LoRA freezes the pre-trained model weights and injects trainable rank decomposition matrices.',
    chunk: 'We propose Low-Rank Adaptation (LoRA), which freezes the pre-trained model weights and injects trainable rank decomposition matrices into each layer.',
  },
  {
    id: 's03',
    category: 'supported',
    split: 'tuning',
    expectedSupported: true,
    claim: 'BERT-Base uses 12 layers, 768 hidden dimensions, 12 attention heads, and 110M total parameters.',
    chunk: 'BERT-Base: L=12, H=768, A=12, Total Parameters=110M. Evaluated across GLUE benchmarks.',
  },
  {
    id: 's04',
    category: 'supported',
    split: 'tuning',
    expectedSupported: true,
    claim: 'ResNet-152 achieved a 4.49% top-5 error rate on the ImageNet validation set.',
    chunk: 'Our 152-layer residual network achieves 4.49% top-5 error on the ImageNet validation set, winning 1st place in ILSVRC 2015.',
  },
  {
    id: 's05',
    category: 'supported',
    split: 'tuning',
    expectedSupported: true,
    claim: 'The Adam optimizer recommends default settings of beta1=0.9, beta2=0.999, and epsilon=1e-8.',
    chunk: 'Good default settings for the tested machine learning problems are alpha=0.001, beta1=0.9, beta2=0.999 and epsilon=10^-8.',
  },

  // 6-10: Paraphrased
  {
    id: 'p01',
    category: 'paraphrased',
    split: 'tuning',
    expectedSupported: true,
    claim: 'Processing lengthy texts produces memory exhaustion because self-attention scales quadratically with input length.',
    chunk: 'A primary limitation is that standard self-attention has a computational complexity and memory footprint of O(n^2), restricting its application to very long sequences.',
  },
  {
    id: 'p02',
    category: 'paraphrased',
    split: 'tuning',
    expectedSupported: true,
    claim: 'Rather than altering all base weights, low-rank adapters modify weight updates through low-dimensional factorized projections.',
    chunk: 'Instead of fine-tuning all parameters, LoRA decomposes parameter updates into low-rank matrices, dramatically lowering GPU memory requirements.',
  },
  {
    id: 'p03',
    category: 'paraphrased',
    split: 'tuning',
    expectedSupported: true,
    claim: 'Deep residual architectures overcome convergence degradation by letting identity mappings bypass intermediate layers.',
    chunk: 'To address the degradation problem, we introduce shortcut connections that skip one or more layers, performing identity mapping without added parameters.',
  },
  {
    id: 'p04',
    category: 'paraphrased',
    split: 'tuning',
    expectedSupported: true,
    claim: 'BERT demonstrates that bidirectional contextual pre-training transfers successfully across multiple sentence classification benchmarks.',
    chunk: 'Our experiments verify that bidirectional pre-training provides rich representations that yield state-of-the-art results on eleven natural language tasks.',
  },
  {
    id: 'p05',
    category: 'paraphrased',
    split: 'tuning',
    expectedSupported: true,
    claim: 'Scaling parameters and training data in autoregressive language models yields emergent zero-shot competence.',
    chunk: 'We demonstrate that scaling language models greatly improves task-agnostic few-shot performance, sometimes rivaling prior fine-tuned systems.',
  },

  // 11-15: Completely Unsupported
  {
    id: 'u01',
    category: 'unsupported',
    split: 'tuning',
    expectedSupported: false,
    claim: 'The Transformer architecture incorporates recurrent LSTM memory cells to maintain historical state over long sequences.',
    chunk: 'The Transformer relies entirely on an attention mechanism to draw global dependencies between input and output without using sequence-aligned RNNs or convolution.',
  },
  {
    id: 'u02',
    category: 'unsupported',
    split: 'tuning',
    expectedSupported: false,
    claim: 'Sourdough bread fermentation requires cooling the dough to precisely 4 degrees Celsius for 48 hours.',
    chunk: 'We train BERT-Base on 16 TPU chips for 4 days using a masked language model objective and next sentence prediction.',
  },
  {
    id: 'u03',
    category: 'unsupported',
    split: 'tuning',
    expectedSupported: false,
    claim: 'LoRA requires training all foundational model layers with full backward propagation passes.',
    chunk: 'We freeze the pre-trained model weights and inject trainable rank decomposition matrices, greatly reducing the number of trainable parameters.',
  },
  {
    id: 'u04',
    category: 'unsupported',
    split: 'tuning',
    expectedSupported: false,
    claim: 'The cricket bowler was awarded a wicket via leg before wicket dismissal.',
    chunk: 'Adam is an algorithm for first-order gradient-based optimization of stochastic objective functions, based on adaptive estimates of lower-order moments.',
  },
  {
    id: 'u05',
    category: 'unsupported',
    split: 'tuning',
    expectedSupported: false,
    claim: 'Japanese kanji tokenization requires morphological analyzers prior to WordPiece embedding lookup.',
    chunk: 'BERT uses WordPiece embeddings with a 30,000 token vocabulary. The first token of every sequence is always a special classification token [CLS].',
  },

  // 16-20: Wrong Numbers / Hallucinated Metrics
  {
    id: 'w01',
    category: 'wrong_number',
    split: 'tuning',
    expectedSupported: false,
    claim: 'The big Transformer achieved an extraordinary BLEU score of 48.2 on English-to-German.',
    chunk: 'On the WMT 2014 English-to-German translation task, the big transformer model achieves a BLEU score of 28.4.',
  },
  {
    id: 'w02',
    category: 'wrong_number',
    split: 'tuning',
    expectedSupported: false,
    claim: 'ResNet evaluated a depth of 500 layers to achieve a 1.2% error rate on ImageNet.',
    chunk: 'Our 152-layer residual network achieves 4.49% top-5 error on the ImageNet validation set.',
  },
  {
    id: 'w03',
    category: 'wrong_number',
    split: 'tuning',
    expectedSupported: false,
    claim: 'GPT-3 was trained on 900 billion tokens with 500 billion parameters.',
    chunk: 'GPT-3 175B was trained on 300 billion tokens using filtered Common Crawl and high-quality reference corpora.',
  },
  {
    id: 'w04',
    category: 'wrong_number',
    split: 'tuning',
    expectedSupported: false,
    claim: 'BERT-Base has 340M total parameters across 24 transformer layers.',
    chunk: 'BERT-Base: L=12, H=768, A=12, Total Parameters=110M. BERT-Large: L=24, H=1024, A=16, Total Parameters=340M.',
  },
  {
    id: 'w05',
    category: 'wrong_number',
    split: 'tuning',
    expectedSupported: false,
    claim: 'The Adam optimizer sets the default exponential decay rate beta1 to 0.75 and beta2 to 0.85.',
    chunk: 'Good default settings for the tested machine learning problems are alpha=0.001, beta1=0.9, beta2=0.999 and epsilon=10^-8.',
  },
];

export const heldOutTestCases: LabeledTestCase[] = [
  // 1-5: Held-Out Directly Supported
  {
    id: 'hs01',
    category: 'supported',
    split: 'held-out',
    expectedSupported: true,
    claim: 'Random Forest achieved an accuracy of 82.6% on the custom dataset in predicting whether texts were human-written or AI-generated.',
    chunk: 'The Random Forest model scored an accuracy of 82.6% in predicting the nature of the texts found in the custom dataset. Table VI illustrates Random Forest performance.',
  },
  {
    id: 'hs02',
    category: 'supported',
    split: 'held-out',
    expectedSupported: true,
    claim: 'Human-written texts had a mean Flesch Reading Ease score of 69.69 compared to 53.6 for AI-generated texts.',
    chunk: 'Flesch Reading Ease has a mean value of 69.69 for human-written texts, whereas for AI-generated texts the mean score is 53.6.',
  },
  {
    id: 'hs03',
    category: 'supported',
    split: 'held-out',
    expectedSupported: true,
    claim: 'The custom evaluation dataset consists of 20 records with 10 AI-generated texts from ChatGPT and 10 human-written texts.',
    chunk: 'The dataset consists of 20 records, 10 AIGT and 10 human written texts. The AIGT records were obtained from ChatGPT and the human written records were obtained from Wikipedia.',
  },
  {
    id: 'hs04',
    category: 'supported',
    split: 'held-out',
    expectedSupported: true,
    claim: 'The Adam optimizer computes biased first moment estimate m_t and biased second raw moment estimate v_t using exponentially decaying moving averages.',
    chunk: 'The algorithm updates exponential moving averages of the gradient (m_t) and the squared gradient (v_t) where the hyper-parameters beta1 and beta2 control these decay rates.',
  },
  {
    id: 'hs05',
    category: 'supported',
    split: 'held-out',
    expectedSupported: true,
    claim: 'GPT-3 175B uses 96 attention layers with 96 attention heads in each layer and a hidden dimension of 12288.',
    chunk: 'For the 175B model, n_layers=96, d_model=12288, and n_heads=96, trained with alternate dense and locally banded sparse attention patterns.',
  },

  // 6-10: Held-Out Paraphrased
  {
    id: 'hp01',
    category: 'paraphrased',
    split: 'held-out',
    expectedSupported: true,
    claim: 'Machine-produced writing tends to exhibit higher linguistic reading challenge requiring greater educational attainment.',
    chunk: 'AI-generated texts demonstrated a higher Gunning Fog Index of 11.54 compared to 10.24 in human essays, reflecting more complex sentence construction and vocabulary that demands more schooling to comprehend.',
  },
  {
    id: 'hp02',
    category: 'paraphrased',
    split: 'held-out',
    expectedSupported: true,
    claim: 'Deep networks suffer from severe performance deterioration during training when layer depth increases without residual shortcut pathways.',
    chunk: 'When deeper networks are able to start converging, an unexpected degradation problem occurs: with the network depth increasing, accuracy becomes saturated and then degrades rapidly, which is not caused by overfitting.',
  },
  {
    id: 'hp03',
    category: 'paraphrased',
    split: 'held-out',
    expectedSupported: true,
    claim: 'Adapting enormous language models using low-rank matrices eliminates the need to store full individual model checkpoints for separate tasks.',
    chunk: 'LoRA allows deploying multiple specific tasks by sharing the base weights and storing only tiny adapter weights, reducing checkpoint storage overhead by a factor of 10,000x.',
  },
  {
    id: 'hp04',
    category: 'paraphrased',
    split: 'held-out',
    expectedSupported: true,
    claim: 'Sentiment analysis helps classify authorship because texts synthesized by conversational LLMs lean closer to neutral emotion.',
    chunk: 'Gillham conducted an analysis against 100 articles generated by three LLMs for their sentiment and concluded that texts generated by LLMs are closer to the neutral part of the sentimental scale.',
  },
  {
    id: 'hp05',
    category: 'paraphrased',
    split: 'held-out',
    expectedSupported: true,
    claim: 'Transformers dispense with recurrent recurrence and temporal convolution, relying purely on attention mechanisms to link token positions.',
    chunk: 'We propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output.',
  },

  // 11-15: Held-Out Completely Unsupported
  {
    id: 'hu01',
    category: 'unsupported',
    split: 'held-out',
    expectedSupported: false,
    claim: 'The Random Forest model relies on convolutional pooling layers to detect syntactic anomalies in digital essays.',
    chunk: 'Table VI shows the result of the model evaluation process. The Random Forest model scored an accuracy of 82.6% in predicting the nature of the texts found in the custom dataset.',
  },
  {
    id: 'hu02',
    category: 'unsupported',
    split: 'held-out',
    expectedSupported: false,
    claim: 'Quantum entanglement states were utilized to encrypt weights during backpropagation.',
    chunk: 'In training our residual networks, we use stochastic gradient descent with mini-batch size of 256 and weight decay of 0.0001.',
  },
  {
    id: 'hu03',
    category: 'unsupported',
    split: 'held-out',
    expectedSupported: false,
    claim: 'Shor algorithm was implemented on 64 superconducting qubits to factor RSA integers in polynomial time.',
    chunk: 'On the WMT 2014 English-to-German translation task, the big transformer model achieves a BLEU score of 28.4, outperforming the existing best results.',
  },
  {
    id: 'hu04',
    category: 'unsupported',
    split: 'held-out',
    expectedSupported: false,
    claim: 'The study concludes that human writing is indistinguishable from AI writing under all stylistic conditions.',
    chunk: 'The statistical analysis reveals noticeable differences between human-written and AI-generated texts across reading ease, vocabulary richness, and punctuation counts.',
  },
  {
    id: 'hu05',
    category: 'unsupported',
    split: 'held-out',
    expectedSupported: false,
    claim: 'LoRA requires re-initializing the entire transformer backbone with randomized weights before low-rank adaptation begins.',
    chunk: 'When applying LoRA to neural networks, the pre-trained parameters W0 remain frozen and do not receive gradient updates.',
  },

  // 16-20: Held-Out Wrong Numbers / Hallucinated Metrics
  {
    id: 'hw01',
    category: 'wrong_number',
    split: 'held-out',
    expectedSupported: false,
    claim: 'The Random Forest classifier attained an evaluation accuracy of 96.8% on the custom dataset in Table VI.',
    chunk: 'Table VI shows the result: Random Forest attained an accuracy of 0.826 (82.6%), Recall 0.80, and F1 Score 0.81.',
  },
  {
    id: 'hw02',
    category: 'wrong_number',
    split: 'held-out',
    expectedSupported: false,
    claim: 'The evaluation dataset comprised 100 articles with 50 AI samples and 50 human articles.',
    chunk: 'The custom dataset consists of 20 records, 10 AIGT and 10 human written texts.',
  },
  {
    id: 'hw03',
    category: 'wrong_number',
    split: 'held-out',
    expectedSupported: false,
    claim: 'Human-written texts recorded an average text length of 850 words compared to 345 words for AI-written texts.',
    chunk: 'Text length mean value is 422 for human-written texts and 345 for AI-generated texts in Table II and III.',
  },
  {
    id: 'hw04',
    category: 'wrong_number',
    split: 'held-out',
    expectedSupported: false,
    claim: 'The Adam optimizer sets the recommended first moment decay coefficient beta1 to 0.50.',
    chunk: 'Good default settings for the tested machine learning problems are alpha=0.001, beta1=0.9, beta2=0.999 and epsilon=10^-8.',
  },
  {
    id: 'hw05',
    category: 'wrong_number',
    split: 'held-out',
    expectedSupported: false,
    claim: 'ResNet-152 achieved an error rate of 1.49% on ImageNet validation.',
    chunk: 'Our 152-layer residual network achieves 4.49% top-5 error on the ImageNet validation set.',
  },
];

export interface CitationEvalMetrics {
  total: number;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
}

export function evaluateClaimSet(testCases: LabeledTestCase[]): CitationEvalMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const tc of testCases) {
    const result = CitationVerifier.verifyClaimAgainstChunk(tc.claim, tc.chunk);
    if (tc.expectedSupported && result.isSupported) tp++;
    if (!tc.expectedSupported && result.isSupported) fp++;
    if (!tc.expectedSupported && !result.isSupported) tn++;
    if (tc.expectedSupported && !result.isSupported) fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = (tp + tn) / testCases.length;

  return {
    total: testCases.length,
    tp,
    tn,
    fp,
    fn,
    accuracy,
    precision,
    recall,
    f1,
  };
}

export function runCitationVerifierEvaluation() {
  const tuningMetrics = evaluateClaimSet(tuningTestCases);
  const heldOutMetrics = evaluateClaimSet(heldOutTestCases);
  const combinedMetrics = evaluateClaimSet([...tuningTestCases, ...heldOutTestCases]);

  console.log('======================================================');
  console.log('       CITATION VERIFIER EVALUATION RESULTS           ');
  console.log('======================================================');
  console.log(`TUNING SET (n=${tuningMetrics.total}, used for threshold calibration):`);
  console.log(`  Accuracy:  ${(tuningMetrics.accuracy * 100).toFixed(1)}% | Precision: ${(tuningMetrics.precision * 100).toFixed(1)}% | Recall: ${(tuningMetrics.recall * 100).toFixed(1)}% | F1: ${tuningMetrics.f1.toFixed(3)}`);
  console.log(`  TP=${tuningMetrics.tp}, TN=${tuningMetrics.tn}, FP=${tuningMetrics.fp}, FN=${tuningMetrics.fn}`);

  console.log(`\nHELD-OUT SET (n=${heldOutMetrics.total}, blind test on frozen threshold):`);
  console.log(`  Accuracy:  ${(heldOutMetrics.accuracy * 100).toFixed(1)}% | Precision: ${(heldOutMetrics.precision * 100).toFixed(1)}% | Recall: ${(heldOutMetrics.recall * 100).toFixed(1)}% | F1: ${heldOutMetrics.f1.toFixed(3)}`);
  console.log(`  TP=${heldOutMetrics.tp}, TN=${heldOutMetrics.tn}, FP=${heldOutMetrics.fp}, FN=${heldOutMetrics.fn}`);

  console.log(`\nCOMBINED OVERALL (n=${combinedMetrics.total}):`);
  console.log(`  Accuracy:  ${(combinedMetrics.accuracy * 100).toFixed(1)}% | Precision: ${(combinedMetrics.precision * 100).toFixed(1)}% | Recall: ${(combinedMetrics.recall * 100).toFixed(1)}% | F1: ${combinedMetrics.f1.toFixed(3)}`);
  console.log('======================================================\n');

  return { tuningMetrics, heldOutMetrics, combinedMetrics };
}

// Run standalone if executed directly
const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('eval_citation_verifier.ts');
if (isDirectRun) {
  runCitationVerifierEvaluation();
}
