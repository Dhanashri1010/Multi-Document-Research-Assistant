import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { DocumentChunkModel } from '../src/models/DocumentChunk.js';
import { DocumentModel } from '../src/models/Document.js';
import { config } from '../src/config/env.js';

async function checkDetails() {
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);

  // 1. Attention complexity
  const att = await DocumentModel.findOne({ originalName: /Attention/i }).lean();
  if (att) {
    const chunks = await DocumentChunkModel.find({ documentId: att._id, text: /Table 1/i }).lean();
    console.log('=== ATTENTION TABLE 1 ===');
    chunks.forEach(c => console.log(`p.${c.pageNumber}: ${c.text.slice(0, 500)}`));
  }

  // 2. LoRA Delta W and alpha/r
  const lora = await DocumentModel.findOne({ originalName: /LoRA/i }).lean();
  if (lora) {
    const chunks = await DocumentChunkModel.find({ documentId: lora._id, text: /modified forward pass/i }).lean();
    console.log('\n=== LORA FORWARD PASS & DELTA W ===');
    chunks.forEach(c => console.log(`p.${c.pageNumber}: ${c.text.slice(0, 500)}`));
  }

  // 3. Adam hyperparameters and equations
  const adam = await DocumentModel.findOne({ originalName: /Adam/i }).lean();
  if (adam) {
    const chunks = await DocumentChunkModel.find({ documentId: adam._id, text: /Algorithm 1/i }).lean();
    console.log('\n=== ADAM ALGORITHM 1 ===');
    chunks.forEach(c => console.log(`p.${c.pageNumber}: ${c.text.slice(0, 600)}`));
  }

  // 4. ResNet residual formula
  const resnet = await DocumentModel.findOne({ originalName: /Residual/i }).lean();
  if (resnet) {
    const chunks = await DocumentChunkModel.find({ documentId: resnet._id, text: /F\(x/i }).lean();
    console.log('\n=== RESNET F(x) ===');
    chunks.forEach(c => console.log(`p.${c.pageNumber}: ${c.text.slice(0, 500)}`));
  }

  // 5. BERT sequence length (512)
  const bert = await DocumentModel.findOne({ originalName: /BERT/i }).lean();
  if (bert) {
    const chunks = await DocumentChunkModel.find({ documentId: bert._id, text: /512/i }).lean();
    console.log('\n=== BERT 512 ===');
    chunks.forEach(c => console.log(`p.${c.pageNumber}: ${c.text.slice(0, 300)}`));
  }

  await mongoose.disconnect();
}

checkDetails().catch(console.error);

