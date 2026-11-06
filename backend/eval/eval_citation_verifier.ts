import { CitationVerifier } from '../src/services/ai/citationVerifier.js';

interface LabeledTestCase {
  id: string;
  category: 'supported' | 'paraphrased' | 'unsupported' | 'wrong_number';
  expectedSupported: boolean;
  claim: string;
  chunk: string;
}

const testCases: LabeledTestCase[] = [
  // 1-5: Directly Supported
  {
    id: 's01',
    category: 'supported',
    expectedSupported: true,
    claim: 'The Transformer model achieved a BLEU score of 28.4 on the WMT 2014 English-to-German translation benchmark.',
    chunk: 'On the WMT 2014 English-to-German translation task, the big transformer model achieves a BLEU score of 28.4, outperforming the existing best results.',
  },
  {
    id: 's02',
    category: 'supported',
    expectedSupported: true,
    claim: 'LoRA freezes the pre-trained model weights and injects trainable rank decomposition matrices.',
    chunk: 'We propose Low-Rank Adaptation (LoRA), which freezes the pre-trained model weights and injects trainable rank decomposition matrices into each layer.',
  },
  {
    id: 's03',
    category: 'supported',
    expectedSupported: true,
    claim: 'BERT-Base uses 12 layers, 768 hidden dimensions, 12 attention heads, and 110M total parameters.',
    chunk: 'BERT-Base: L=12, H=768, A=12, Total Parameters=110M. Evaluated across GLUE benchmarks.',
  },
  {
    id: 's04',
    category: 'supported',
    expectedSupported: true,
    claim: 'ResNet-152 achieved a 4.49% top-5 error rate on the ImageNet validation set.',
    chunk: 'Our 152-layer residual network achieves 4.49% top-5 error on the ImageNet validation set, winning 1st place in ILSVRC 2015.',
  },
  {
    id: 's05',
    category: 'supported',
    expectedSupported: true,
    claim: 'The Adam optimizer recommends default settings of beta1=0.9, beta2=0.999, and epsilon=1e-8.',
    chunk: 'Good default settings for the tested machine learning problems are alpha=0.001, beta1=0.9, beta2=0.999 and epsilon=10^-8.',
  },

  // 6-10: Paraphrased
  {
    id: 'p01',
    category: 'paraphrased',
    expectedSupported: true,
    claim: 'Processing lengthy texts produces memory exhaustion because self-attention scales quadratically with input length.',
    chunk: 'A primary limitation is that standard self-attention has a computational complexity and memory footprint of O(n^2), restricting its application to very long sequences.',
  },
  {
    id: 'p02',
    category: 'paraphrased',
    expectedSupported: true,
    claim: 'LoRA prevents storage explosions across multiple fine-tuned models by keeping task-specific weights tiny.',
    chunk: 'LoRA reduces storage requirements by roughly 10,000x for large models, making it feasible to deploy multiple task-specific adapters without multiplying checkpoint size.',
  },
  {
    id: 'p03',
    category: 'paraphrased',
    expectedSupported: true,
    claim: 'BERT reads context bidirectionally rather than strictly scanning words from left to right.',
    chunk: 'Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.',
  },
  {
    id: 'p04',
    category: 'paraphrased',
    expectedSupported: true,
    claim: 'Deep visual architectures suffer from accuracy degradation during training because optimization becomes difficult.',
    chunk: 'When deeper networks are able to start converging, a degradation problem has been exposed: with the network depth increasing, accuracy gets saturated and then degrades rapidly.',
  },
  {
    id: 'p05',
    category: 'paraphrased',
    expectedSupported: true,
    claim: 'Few-shot prompting allows autoregressive models to solve tasks at inference time without gradient descent weight modifications.',
    chunk: 'In few-shot learning, the model is conditioned on a few demonstrations of the task at inference time, with no gradient updates or fine-tuning performed.',
  },

  // 11-15: Unsupported (Completely unrelated or inverted claims)
  {
    id: 'u01',
    category: 'unsupported',
    expectedSupported: false,
    claim: 'Shor algorithm factors prime integers in polynomial time using quantum phase estimation.',
    chunk: 'On the WMT 2014 English-to-German translation task, the big transformer model achieves a BLEU score of 28.4.',
  },
  {
    id: 'u02',
    category: 'unsupported',
    expectedSupported: false,
    claim: 'ResNet replaces all convolutional filters with recurrent neural network cells.',
    chunk: 'We introduce deep residual networks using shortcut connections that simply perform identity mapping, without adding extra parameter complexity.',
  },
  {
    id: 'u03',
    category: 'unsupported',
    expectedSupported: false,
    claim: 'LoRA requires training all foundational model layers with full backward propagation passes.',
    chunk: 'We freeze the pre-trained model weights and inject trainable rank decomposition matrices, greatly reducing the number of trainable parameters.',
  },
  {
    id: 'u04',
    category: 'unsupported',
    expectedSupported: false,
    claim: 'The cricket bowler was awarded a wicket via leg before wicket dismissal.',
    chunk: 'Adam is an algorithm for first-order gradient-based optimization of stochastic objective functions, based on adaptive estimates of lower-order moments.',
  },
  {
    id: 'u05',
    category: 'unsupported',
    expectedSupported: false,
    claim: 'Japanese kanji tokenization requires morphological analyzers prior to WordPiece embedding lookup.',
    chunk: 'BERT uses WordPiece embeddings with a 30,000 token vocabulary. The first token of every sequence is always a special classification token [CLS].',
  },

  // 16-20: Wrong Numbers / Hallucinated Metrics
  {
    id: 'w01',
    category: 'wrong_number',
    expectedSupported: false,
    claim: 'The big Transformer achieved an extraordinary BLEU score of 48.2 on English-to-German.',
    chunk: 'On the WMT 2014 English-to-German translation task, the big transformer model achieves a BLEU score of 28.4.',
  },
  {
    id: 'w02',
    category: 'wrong_number',
    expectedSupported: false,
    claim: 'ResNet evaluated a depth of 500 layers to achieve a 1.2% error rate on ImageNet.',
    chunk: 'Our 152-layer residual network achieves 4.49% top-5 error on the ImageNet validation set.',
  },
  {
    id: 'w03',
    category: 'wrong_number',
    expectedSupported: false,
    claim: 'GPT-3 was trained on 900 billion tokens with 500 billion parameters.',
    chunk: 'GPT-3 175B was trained on 300 billion tokens using filtered Common Crawl and high-quality reference corpora.',
  },
  {
    id: 'w04',
    category: 'wrong_number',
    expectedSupported: false,
    claim: 'BERT-Base has 340M total parameters across 24 transformer layers.',
    chunk: 'BERT-Base: L=12, H=768, A=12, Total Parameters=110M. BERT-Large: L=24, H=1024, A=16, Total Parameters=340M.',
  },
  {
    id: 'w05',
    category: 'wrong_number',
    expectedSupported: false,
    claim: 'The Adam optimizer sets the default exponential decay rate beta1 to 0.75 and beta2 to 0.85.',
    chunk: 'Good default settings for the tested machine learning problems are alpha=0.001, beta1=0.9, beta2=0.999 and epsilon=10^-8.',
  },
];

console.log('Evaluating CitationVerifier across', testCases.length, 'labeled test claims...\n');

let tp = 0; // expected true, predicted true
let fp = 0; // expected false, predicted true
let tn = 0; // expected false, predicted false
let fn = 0; // expected true, predicted false

for (const tc of testCases) {
  const result = CitationVerifier.verifyClaimAgainstChunk(tc.claim, tc.chunk);
  const correct = result.isSupported === tc.expectedSupported;

  if (tc.expectedSupported && result.isSupported) tp++;
  if (!tc.expectedSupported && result.isSupported) fp++;
  if (!tc.expectedSupported && !result.isSupported) tn++;
  if (tc.expectedSupported && !result.isSupported) fn++;

  const status = correct ? '✓ PASS' : '✗ FAIL';
  console.log(`[${tc.id}] [${tc.category.padEnd(12)}] ${status} | Pred: ${result.isSupported} (Expected: ${tc.expectedSupported}) | score=${result.supportScore} ${result.reason ? '(' + result.reason + ')' : ''}`);
}

const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
const accuracy = (tp + tn) / testCases.length;

console.log('\n====================================');
console.log('  CITATION VERIFIER BENCHMARK RESULTS');
console.log('====================================');
console.log(`Total Cases: ${testCases.length}`);
console.log(`True Positives (TP): ${tp}`);
console.log(`True Negatives (TN): ${tn}`);
console.log(`False Positives (FP): ${fp}`);
console.log(`False Negatives (FN): ${fn}`);
console.log(`Accuracy:  ${(accuracy * 100).toFixed(1)}%`);
console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
console.log(`Recall:    ${(recall * 100).toFixed(1)}%`);
console.log(`F1 Score:  ${f1.toFixed(3)}`);
console.log('====================================\n');

