/**
 * Safe Migration Script for Legacy Documents
 * Scans local MongoDB documents without a userId and reports their physical storage status.
 *
 * Usage:
 *   Dry-run inspection (default, read-only):
 *     npx tsx scripts/migrate_legacy_documents.ts
 *
 *   Assign to user (requires explicit execution and user email):
 *     npx tsx scripts/migrate_legacy_documents.ts --assign user@example.com --execute
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { DocumentModel } from '../src/models/Document.js';
import { UserModel } from '../src/models/User.js';
import { DocumentChunkModel } from '../src/models/DocumentChunk.js';
import { config } from '../src/config/env.js';

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const assignIdx = args.indexOf('--assign');
  const targetEmail = assignIdx !== -1 ? args[assignIdx + 1] : undefined;

  console.log('====================================================');
  console.log('   Multi-Document Assistant: Legacy Data Migration   ');
  console.log('====================================================\n');

  console.log(`Connecting to MongoDB at: ${config.mongoUri}...`);
  await mongoose.connect(config.mongoUri);

  const totalDocs = await DocumentModel.countDocuments();
  const legacyDocs = await DocumentModel.find({
    $or: [{ userId: { $exists: false } }, { userId: null }],
  });

  console.log(`Total documents in database: ${totalDocs}`);
  console.log(`Legacy documents without userId: ${legacyDocs.length}\n`);

  if (legacyDocs.length === 0) {
    console.log('No legacy documents requiring migration. All documents are assigned to users.');
    await mongoose.disconnect();
    return;
  }

  console.log('--- Legacy Documents Inventory ---');
  let missingFilesCount = 0;
  for (const doc of legacyDocs) {
    const fileExists = doc.filePath ? fs.existsSync(doc.filePath) : false;
    if (!fileExists) missingFilesCount++;
    const statusMark = fileExists ? '✓' : '✗ MISSING FILE';
    console.log(`- [${statusMark}] ID: ${doc._id} | "${doc.originalName}" (${doc.pageCount} pages, status: ${doc.status})`);
  }
  console.log('');

  if (!isExecute || !targetEmail) {
    console.log('=== DRY-RUN AUDIT COMPLETED ===');
    console.log('NO database changes were made.');
    console.log(`Status: ${legacyDocs.length} legacy documents are currently preserved and accessible via backward-compatible queries.`);
    if (missingFilesCount > 0) {
      console.log(`Warning: ${missingFilesCount} document(s) have physical file paths that were not found on disk.`);
    }
    console.log('\nTo assign these documents to a registered user account after registration:');
    console.log('  npx tsx scripts/migrate_legacy_documents.ts --assign <user_email> --execute\n');
    await mongoose.disconnect();
    return;
  }

  // Explicit execution requested
  const targetUser = await UserModel.findOne({ email: targetEmail.toLowerCase().trim() });
  if (!targetUser) {
    console.error(`Error: User with email "${targetEmail}" was not found in the database. Please register the user account first.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Target User confirmed: ${targetUser.name} (${targetUser.email}, ID: ${targetUser._id})`);
  console.log(`Migrating ${legacyDocs.length} documents to user ID: ${targetUser._id}...`);

  const docIds = legacyDocs.map((d) => d._id);
  const docUpdateResult = await DocumentModel.updateMany(
    { _id: { $in: docIds } },
    { $set: { userId: targetUser._id } }
  );

  const chunkUpdateResult = await DocumentChunkModel.updateMany(
    { documentId: { $in: docIds } },
    { $set: { userId: targetUser._id } }
  );

  console.log(`Successfully updated ${docUpdateResult.modifiedCount} document records.`);
  console.log(`Successfully updated ${chunkUpdateResult.modifiedCount} document chunk records.`);
  console.log('Migration complete. All legacy documents are now owned by the target user.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
