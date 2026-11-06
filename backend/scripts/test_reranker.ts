import { pipeline } from '@xenova/transformers';

async function testReranker() {
  const classifier = await pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2');

  const q = 'Who are the authors of Attention Is All You Need?';
  const p1 = 'Attention Is All You Need was authored by Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit from Google Brain.';
  const p2 = 'In this paper we explore baking sourdough bread at 250 degrees celsius.';

  const out1 = await (classifier as any)(q, p1);
  const out2 = await (classifier as any)(q, p2);

  console.log('Relevant passage score:', out1);
  console.log('Irrelevant passage score:', out2);
}

testReranker();
