import { pipeline } from '@xenova/transformers';

async function testBGE() {
  console.log('Testing Xenova/bge-small-en-v1.5...');
  try {
    const extractor = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
    const out = await extractor('Hello world', { pooling: 'mean', normalize: true });
    console.log('BGE-small output dim:', out.dims);
  } catch (err: any) {
    console.error('BGE test error:', err.message);
  }
}

testBGE();

