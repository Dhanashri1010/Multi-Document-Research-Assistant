import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { DocumentChunkModel } from '../src/models/DocumentChunk.js';
import { DocumentModel } from '../src/models/Document.js';
import { config } from '../src/config/env.js';

async function inspect() {
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);

  const docs = await DocumentModel.find({ status: 'ready' }).lean();

  console.log('=== SEARCHING CHUNKS FOR RELEVANT STRINGS ===\n');

  // 1. Attention authors on page 1
  const attDoc = docs.find(d => d.originalName.includes('Attention'));
  if (attDoc) {
    const p1Chunks = await DocumentChunkModel.find({ documentId: attDoc._id, pageNumber: 1 }).lean();
    console.log(`[Attention Is All You Need - Page 1 Chunks: ${p1Chunks.length}]`);
    p1Chunks.forEach((c, idx) => {
      console.log(`--- Chunk ${idx + 1} (${c.text.length} chars) ---`);
      console.log(c.text.slice(0, 400));
    });
  }

  // 2. Attention Table 1 complexity
  if (attDoc) {
    const compChunks = await DocumentChunkModel.find({
      documentId: attDoc._id,
      text: { $regex: /complexity|table 1/i }
    }).lean();
    console.log(`\n[Attention Is All You Need - Complexity Chunks: ${compChunks.length}]`);
    compChunks.forEach((c, idx) => {
      console.log(`--- Page ${c.pageNumber} Chunk (${c.text.length} chars) ---`);
      console.log(c.text.slice(0, 300));
    });
  }

  // 3. LoRA Delta W decomposition
  const loraDoc = docs.find(d => d.originalName.includes('LoRA'));
  if (loraDoc) {
    const loraChunks = await DocumentChunkModel.find({
      documentId: loraDoc._id,
      pageNumber: { $in: [1, 2, 3, 4] }
    }).lean();
    console.log(`\n[LoRA - Pages 1-4 Chunks: ${loraChunks.length}]`);
    loraChunks.forEach((c, idx) => {
      if (c.text.includes('BA') || c.text.includes('W 0') || c.text.includes('rank') || c.text.includes('350')) {
        console.log(`--- Page ${c.pageNumber} (chars: ${c.text.length}) ---`);
        console.log(c.text.slice(0, 350));
      }
    });
  }

  // 4. Paper 21 tables (Table II, III, IV)
  const p21Doc = docs.find(d => d.originalName.includes('Unmasking') || d.originalName.includes('Paper_21'));
  if (p21Doc) {
    const p21Chunks = await DocumentChunkModel.find({
      documentId: p21Doc._id,
      pageNumber: { $in: [4, 5, 6] }
    }).lean();
    console.log(`\n[Paper 21 - Pages 4-6 Chunks: ${p21Chunks.length}]`);
    p21Chunks.forEach((c, idx) => {
      console.log(`--- Page ${c.pageNumber} Section: ${c.section} (chars: ${c.text.length}) ---`);
      console.log(c.text.slice(0, 300));
    });
  }

  await mongoose.disconnect();
}

inspect().catch(console.error);

