import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { DocumentModel } from '../src/models/Document.js';
import { IngestionService } from '../src/services/documents/ingestionService.js';
import { config } from '../src/config/env.js';

const REAL_PAPERS = [
  { sample: 'attention_is_all_you_need.pdf', name: 'Attention Is All You Need', filename: 'eval_attention.pdf' },
  { sample: 'lora_low_rank_adaptation.pdf', name: 'LoRA: Low-Rank Adaptation', filename: 'eval_lora.pdf' },
  { sample: 'bert_pretraining_deep_bidirectional.pdf', name: 'BERT: Pre-training of Deep Bidirectional Transformers', filename: 'eval_bert.pdf' },
  { sample: 'resnet_deep_residual_learning.pdf', name: 'Deep Residual Learning for Image Recognition', filename: 'eval_resnet.pdf' },
  { sample: 'gpt3_language_models_few_shot.pdf', name: 'Language Models are Few-Shot Learners', filename: 'eval_gpt3.pdf' },
  { sample: 'adam_stochastic_optimization.pdf', name: 'Adam: A Method for Stochastic Optimization', filename: 'eval_adam.pdf' },
  { sample: 'Paper_21-Unmasking_AI_Generated_Texts.pdf', name: 'Unmasking AI-Generated Texts Using Linguistic and Stylistic Features', filename: 'eval_paper21_unmasking.pdf' },
];

async function main() {
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);

  const uploadDir = fs.existsSync(path.resolve(process.cwd(), 'uploads'))
    ? path.resolve(process.cwd(), 'uploads')
    : path.resolve(process.cwd(), 'backend', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  console.log('====================================================');
  console.log('  SYNCING REAL RESEARCH PAPERS INTO UPLOADS & DB    ');
  console.log('====================================================\n');

  for (const paper of REAL_PAPERS) {
    const samplePath = fs.existsSync(path.resolve(process.cwd(), 'samples', paper.sample))
      ? path.resolve(process.cwd(), 'samples', paper.sample)
      : path.resolve(process.cwd(), '..', 'samples', paper.sample);
    const destPath = path.join(uploadDir, paper.filename);

    if (!fs.existsSync(samplePath)) {
      console.error(`Sample file not found: ${samplePath}`);
      continue;
    }

    const stat = fs.statSync(samplePath);
    console.log(`Copying real PDF: ${paper.sample} (${stat.size} bytes) -> ${destPath}`);
    fs.copyFileSync(samplePath, destPath);

    let doc = await DocumentModel.findOne({
      $or: [{ originalName: paper.name }, { filename: paper.filename }]
    });

    if (!doc) {
      doc = await DocumentModel.create({
        filename: paper.filename,
        originalName: paper.name,
        fileSize: stat.size,
        mimeType: 'application/pdf',
        filePath: destPath,
        status: 'uploaded',
      });
      console.log(`Created new document record: "${paper.name}"`);
    } else {
      doc.originalName = paper.name;
      doc.filename = paper.filename;
      doc.fileSize = stat.size;
      doc.filePath = destPath;
      doc.status = 'uploaded';
      await doc.save();
      console.log(`Updated existing document record: "${paper.name}"`);
    }

    // Ingest with latest pipeline
    console.log(`Ingesting "${paper.name}"...`);
    await IngestionService.processDocument(doc._id);
    const updated = await DocumentModel.findById(doc._id);
    console.log(`  ✓ Finished: ${updated?.pageCount} pages, ${updated?.chunkCount} chunks, status: ${updated?.status}\n`);
  }

  // Also check existing user documents in the database
  const otherDocs = await DocumentModel.find({
    filename: { $nin: REAL_PAPERS.map(p => p.filename) }
  });

  if (otherDocs.length > 0) {
    console.log(`\nRe-processing ${otherDocs.length} user-uploaded documents with updated scanned detection...`);
    for (const d of otherDocs) {
      console.log(`Re-ingesting "${d.originalName}" (${d.filename})...`);
      try {
        await IngestionService.processDocument(d._id);
        const up = await DocumentModel.findById(d._id);
        console.log(`  ✓ Status: ${up?.status}, Pages: ${up?.pageCount}, Chunks: ${up?.chunkCount}, Warning: ${up?.warning || 'None'}`);
      } catch (err: any) {
        console.error(`  ✗ Error: ${err.message}`);
      }
    }
  }

  console.log('\n====================================================');
  console.log('       COMPLETE DATABASE DOCUMENT AUDIT TABLE       ');
  console.log('====================================================');
  const allDocs = await DocumentModel.find({}).sort({ createdAt: 1 });
  console.log(
    'ID'.padEnd(26) +
    'Original Name'.padEnd(46) +
    'Pages'.padStart(7) +
    'Chunks'.padStart(8) +
    'Status'.padStart(10) +
    '  Warning / Notice'
  );
  console.log('-'.repeat(110));

  for (const d of allDocs) {
    const id = d._id.toString().padEnd(26);
    const name = (d.originalName || d.filename).slice(0, 44).padEnd(46);
    const pages = String(d.pageCount || 0).padStart(7);
    const chunks = String(d.chunkCount || 0).padStart(8);
    const status = (d.status || '').padStart(10);
    const warning = d.warning ? `[Warning: ${d.warning.slice(0, 45)}...]` : 'OK';
    console.log(`${id}${name}${pages}${chunks}${status}  ${warning}`);
  }
  console.log('='.repeat(110) + '\n');

  await mongoose.disconnect();
}

main().catch(console.error);
