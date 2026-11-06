import { AutoModelForSequenceClassification, AutoTokenizer } from '@xenova/transformers';

async function testCrossEncoder() {
  const modelId = 'Xenova/ms-marco-MiniLM-L-6-v2';
  const tokenizer = await AutoTokenizer.from_pretrained(modelId);
  const model = await AutoModelForSequenceClassification.from_pretrained(modelId);

  const q = 'Who are the authors of Attention Is All You Need?';
  const p1 = 'Attention Is All You Need was authored by Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit from Google Brain.';
  const p2 = 'In this paper we explore baking sourdough bread at 250 degrees celsius.';

  const inputs1 = await tokenizer(q, { text_pair: p1 });
  const out1 = await model(inputs1);

  const inputs2 = await tokenizer(q, { text_pair: p2 });
  const out2 = await model(inputs2);

  console.log('Relevant passage raw logit:', out1.logits.data[0]);
  console.log('Irrelevant passage raw logit:', out2.logits.data[0]);
}

testCrossEncoder().catch(console.error);

