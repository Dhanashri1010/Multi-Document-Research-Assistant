/**
 * Safe Migration CLI Script for Legacy Documents & Sessions
 * Usage:
 *   Dry-run inspection (default, read-only):
 *     npx tsx scripts/migrate_legacy_documents.ts
 *
 *   Assign to user (requires explicit execution and user email):
 *     npx tsx scripts/migrate_legacy_documents.ts --assign user@example.com --execute
 */

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { migrateLegacyData } from '../src/services/migration/legacyMigrationService.js';

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

  try {
    if (!isExecute || !targetEmail) {
      const summary = await migrateLegacyData({ targetEmail: '', isExecute: false });
      console.log(`Total documents in database: ${summary.totalDocs}`);
      console.log(`Legacy documents without userId: ${summary.legacyDocsFound}`);
      console.log(`Total research sessions in database: ${summary.totalSessions}`);
      console.log(`Legacy sessions without userId: ${summary.legacySessionsFound}\n`);

      console.log('=== DRY-RUN AUDIT COMPLETED ===');
      console.log('NO database changes were made.');
      console.log('\nTo safely assign these records to a registered user account:');
      console.log('  npx tsx scripts/migrate_legacy_documents.ts --assign <user_email> --execute\n');
      return;
    }

    console.log(`Running migration for target user: ${targetEmail}...`);
    const result = await migrateLegacyData({ targetEmail, isExecute: true });

    console.log('=== MIGRATION COMPLETED SUCCESSFULLY ===');
    console.log(`- Documents claimed: ${result.documentsClaimed}`);
    if (result.documentsSkippedDueToOwnershipChange > 0) {
      console.log(`- Documents skipped (ownership changed concurrently): ${result.documentsSkippedDueToOwnershipChange}`);
    }
    console.log(`- Chunks claimed: ${result.chunksClaimed}`);
    console.log(`- Sessions claimed: ${result.sessionsClaimed}`);
    if (result.sessionsSkippedDueToOwnershipChange > 0) {
      console.log(`- Sessions skipped (ownership changed concurrently): ${result.sessionsSkippedDueToOwnershipChange}`);
    }
    console.log(`- Used MongoDB Transaction: ${result.usedTransaction ? 'YES' : 'NO (Compensation Rollback enabled)'}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
