import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { DocumentChunkModel } from '../src/models/DocumentChunk.js';
import { DocumentModel } from '../src/models/Document.js';
import { config } from '../src/config/env.js';

async function checkResnet() {
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);

  const resnet = await DocumentModel.findOne({ originalName: /Residual/i }).lean();
  if (resnet) {
    const chunks = await DocumentChunkModel.find({ documentId: resnet._id, pageNumber: { $in: [2, 3] } }).lean();
    console.log(`=== RESNET PAGES 2-3 (${chunks.length} chunks) ===`);
    chunks.forEach((c, i) => {
      console.log(`--- Chunk ${i + 1} (p.${c.pageNumber}) ---`);
      console.log(c.text.slice(0, 400));
    });
  }

  await mongoose.disconnect();
}

checkResnet().catch(console.error);

