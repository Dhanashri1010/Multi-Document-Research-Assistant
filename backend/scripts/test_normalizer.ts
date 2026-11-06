import { containsNormalized, normalizeTextForMatching } from '../eval/textNormalizer.js';

const tests = [
  { haystack: 'We then scale ∆ Wx by , where α r', needle: 'Delta W', expected: true },
  { haystack: 'We then scale ∆ Wx by , where α r', needle: 'alpha / r', expected: true },
  { haystack: 'y = F ( x , { W i } ) + x . (1)', needle: 'F(x, {W_i}) + x', expected: true },
  { haystack: 'β 1 = 0 . 9 , β 2 = 0 . 999 and = 10', needle: 'beta_2', expected: true },
  { haystack: 'resulting in bias-corrected estimates m ̂ t and v ̂ t', needle: 'hat{m}_t', expected: true },
  { haystack: 'checkpoint size is 350 GB on disk', needle: '350GB', expected: true },
  { haystack: 'computational complexity per layer is O ( n 2 · d )', needle: 'O(n^2)', expected: true },
];

console.log('Testing Normalizer:');
for (const t of tests) {
  const normH = normalizeTextForMatching(t.haystack);
  const normN = normalizeTextForMatching(t.needle);
  const matched = containsNormalized(t.haystack, t.needle);
  console.log(`Needle: "${t.needle}" -> "${normN}"`);
  console.log(`Haystack: "${t.haystack}" -> "${normH}"`);
  console.log(`Result: ${matched} (expected ${t.expected}) | PASS: ${matched === t.expected}\n`);
}

