import { performance } from 'perf_hooks';

async function testLiveAPI() {
  console.log('--- Test 1: Grounded Question ---');
  const t0 = performance.now();
  const resp1 = await fetch('http://localhost:5000/api/chat/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What is the attention mechanism in this paper?',
      documentIds: ['6aeca7719a11756eb91a0bb9'],
    }),
  });
  const t1 = performance.now();
  const data1 = await resp1.json() as any;
  console.log(`- Latency: ${(t1 - t0).toFixed(2)} ms`);
  console.log(`- Answer: ${data1.answer?.slice(0, 140)}...`);
  console.log(`- Citations: ${data1.citations?.length || 0}`);
  console.log(`- Insufficient Evidence: ${data1.hasInsufficientEvidence}`);

  console.log('\n--- Test 2: Out-of-Scope / Insufficient Evidence Question ---');
  const t2 = performance.now();
  const resp2 = await fetch('http://localhost:5000/api/chat/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What was the GDP and population of Mongolia in 2023?',
      documentIds: ['6aeca7719a11756eb91a0bb9'],
    }),
  });
  const t3 = performance.now();
  const data2 = await resp2.json() as any;
  console.log(`- Latency: ${(t3 - t2).toFixed(2)} ms`);
  console.log(`- Answer: ${data2.answer}`);
  console.log(`- Citations: ${data2.citations?.length || 0}`);
  console.log(`- Insufficient Evidence: ${data2.hasInsufficientEvidence}`);

  console.log('\n--- Test 3: Cross-Document Comparison (10 Dimensions) ---');
  const t4 = performance.now();
  const resp3 = await fetch('http://localhost:5000/api/research/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentIds: ['6aeca7719a11756eb91a0bb9', '6aeca7739a11756eb91a0bca'],
    }),
  });
  const t5 = performance.now();
  const data3 = await resp3.json() as any;
  console.log(`- Latency: ${(t5 - t4).toFixed(2)} ms`);
  console.log(`- Matrix Dimensions Count: ${data3.matrix?.length || data3.comparison?.matrix?.length || 0}`);
  const matrix = data3.matrix || data3.comparison?.matrix;
  if (matrix) {
    console.log(`- Dimensions: ${matrix.map((m: any) => m.dimension).join(', ')}`);
  }
  console.log(`- Similarities Count: ${data3.similarities?.length || data3.comparison?.similarities?.length || 0}`);
  console.log(`- Differences Count: ${data3.differences?.length || data3.comparison?.differences?.length || 0}`);
  console.log(`- Degraded Mode: ${data3.degraded ?? data3.comparison?.degraded ?? false}`);
}

testLiveAPI().catch(console.error);
