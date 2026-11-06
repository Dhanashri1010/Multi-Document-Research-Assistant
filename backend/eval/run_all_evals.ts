import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { runEvaluation, EvalMetrics } from './evaluate.js';
import { evaluateAnswerRate, AnswerRateMetrics, SpotCheckRecord } from './eval_answer_rate.js';
import {
  evaluateClaimSet,
  tuningTestCases,
  heldOutTestCases,
  CitationEvalMetrics,
} from './eval_citation_verifier.js';
import { DocumentModel } from '../src/models/Document.js';
import { config } from '../src/config/env.js';

export async function runAllEvaluations() {
  console.log('======================================================');
  console.log('  MULTI-DOCUMENT RESEARCH ASSISTANT - COMPREHENSIVE EVAL');
  console.log('  Running: Retrieval + Full Pipeline + Citation Verifier');
  console.log('======================================================\n');

  // Step 1: Retrieval Evaluation (Content-based hit scoring)
  console.log('>>> [1/3] Running Retrieval Evaluation on Real Corpus...');
  const retrievalMetrics: EvalMetrics = await runEvaluation();

  // Step 2: Full Pipeline Answer Rate & Refusal
  console.log('\n>>> [2/3] Running Full Pipeline Grounded Answer Rate & Faithfulness...');
  const answerRateResults = await evaluateAnswerRate();

  // Step 3: Citation Verifier Evaluation (Tuning n=20 + Held-Out n=20)
  console.log('\n>>> [3/3] Running Citation Verifier Benchmark (Tuning & Held-Out)...');
  const tuningCitation = await evaluateClaimSet(tuningTestCases);
  const heldOutCitation = await evaluateClaimSet(heldOutTestCases);
  const combinedCitation = await evaluateClaimSet([...tuningTestCases, ...heldOutTestCases]);

  // Step 4: Database Corpus Audit
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);
  const allDocs = await DocumentModel.find({}).sort({ createdAt: 1 }).lean();
  await mongoose.disconnect();

  // Step 5: Format and write docs/EVAL_RESULTS.md
  console.log('\n>>> Writing results to docs/EVAL_RESULTS.md...');
  const markdown = generateMarkdownReport({
    retrieval: retrievalMetrics,
    answerRate: answerRateResults,
    citation: {
      tuning: tuningCitation,
      heldOut: heldOutCitation,
      combined: combinedCitation,
    },
    docs: allDocs,
  });

  const docsPath = fs.existsSync(path.resolve(process.cwd(), 'docs'))
    ? path.resolve(process.cwd(), 'docs', 'EVAL_RESULTS.md')
    : path.resolve(process.cwd(), '..', 'docs', 'EVAL_RESULTS.md');

  fs.writeFileSync(docsPath, markdown, 'utf8');
  console.log(`✓ Successfully updated ${docsPath}`);
  console.log('======================================================\n');
}

function generateMarkdownReport(data: {
  retrieval: EvalMetrics;
  answerRate: {
    tuningMetrics: AnswerRateMetrics;
    heldOutMetrics: AnswerRateMetrics;
    overallMetrics: AnswerRateMetrics;
    spotChecks: SpotCheckRecord[];
  };
  citation: {
    tuning: CitationEvalMetrics;
    heldOut: CitationEvalMetrics;
    combined: CitationEvalMetrics;
  };
  docs: any[];
}): string {
  const { retrieval, answerRate, citation, docs } = data;
  const dateStr = new Date().toISOString().split('T')[0];

  const catRows = Object.entries(retrieval.categoryBreakdown)
    .map(([cat, s]) => {
      const h1 = s.total > 0 ? (s.hitAt1).toFixed(1) + '%' : 'N/A';
      const h3 = s.total > 0 ? (s.hitAt3).toFixed(1) + '%' : 'N/A';
      const h5 = s.total > 0 ? (s.hitAt5).toFixed(1) + '%' : 'N/A';
      const mrr = s.total > 0 ? s.mrr.toFixed(3) : 'N/A';
      return `| \`${cat}\` | ${s.total} | ${h1} | ${h3} | ${h5} | ${mrr} |`;
    })
    .join('\n');

  const spotCheckRows = answerRate.spotChecks
    .map((sc, idx) => {
      const qSnippet = sc.query.slice(0, 70);
      const ansSnippet = sc.answerPreview.slice(0, 100);
      return `| ${idx + 1} | \`${sc.id}\` | \`${sc.split}\` | \`${sc.category}\` | ${sc.verdict} (${sc.claimVerification.faithfulnessScore}%) | ${qSnippet}... | ${ansSnippet}... |`;
    })
    .join('\n');

  const docRows = docs
    .map((d) => {
      const name = (d.originalName || d.filename).slice(0, 48);
      const warn = d.warning ? `⚠️ Warning: ${d.warning.slice(0, 50)}...` : '✓ Ready';
      return `| \`${name}\` | ${d.pageCount} | ${d.chunkCount} | \`${d.status}\` | ${warn} |`;
    })
    .join('\n');

  const failedQueriesText = retrieval.failedQueries
    .filter((f) => f.failureType === 'MISSED_GROUND_TRUTH')
    .map((f) => {
      const chunkSnippets = f.retrievedChunks
        .map((ch) => `- **#${ch.rank}** [\`${ch.docName}\`, p.${ch.pageNumber}, score: ${ch.score}]: "${ch.snippet.replace(/"/g, "'")}"`)
        .join('\n');
      return `### Query [${f.id}] (\`${f.split}\`, \`${f.category}\`)\n**Question**: "${f.query}"\n\n**Top-5 Retrieved Chunks**:\n${chunkSnippets}`;
    })
    .join('\n\n');

  return `# Evaluation Results & Tracking

This document tracks empirical retrieval accuracy, grounded generation answer rates, and citation verification across all phases of the **Multi-Document Research Assistant**.

Generated automatically via \`npm run eval\` (\`backend/eval/run_all_evals.ts\`).

---

## 1. Corpus Audit: Real Academic Papers & Documents in Database

All 7 real research papers are fully parsed, chunked with section awareness, embedded with local \`all-MiniLM-L6-v2\` (384-dim), and stored in MongoDB:

| Document Original Name | Pages | Chunks | Status | Scanned / Density Status |
| :--- | :---: | :---: | :---: | :--- |
${docRows}

---

## 2. Retrieval Benchmark (Content-Based Hit Scoring)

> **Scoring Rule Change**: A retrieval **Hit** strictly requires that the retrieved chunk originates from the target paper and **contains the expected answer text (or labeled answer span / key entities)**. Exact page matches without the answer span no longer count as a hit.

### Split Comparison Table:

| Split | Total Queries | Grounded ($n$) | Hit@1 | Hit@3 | Hit@5 | MRR | Keyword Match @ 3 | Pre-LLM Refusal |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tuning Set** | ${retrieval.tuning.totalQueries} | ${retrieval.tuning.relevantQueries} | **${retrieval.tuning.hitAt1}%** | **${retrieval.tuning.hitAt3}%** | **${retrieval.tuning.hitAt5}%** | **${retrieval.tuning.mrr.toFixed(3)}** | **${retrieval.tuning.keywordMatchAt3}%** | **${retrieval.tuning.offTopicRefusalAccuracy}%** |
| **Held-Out Set** | ${retrieval.heldOut.totalQueries} | ${retrieval.heldOut.relevantQueries} | **${retrieval.heldOut.hitAt1}%** | **${retrieval.heldOut.hitAt3}%** | **${retrieval.heldOut.hitAt5}%** | **${retrieval.heldOut.mrr.toFixed(3)}** | **${retrieval.heldOut.keywordMatchAt3}%** | **${retrieval.heldOut.offTopicRefusalAccuracy}%** |
| **Overall** | ${retrieval.overall.totalQueries} | ${retrieval.overall.relevantQueries} | **${retrieval.overall.hitAt1}%** | **${retrieval.overall.hitAt3}%** | **${retrieval.overall.hitAt5}%** | **${retrieval.overall.mrr.toFixed(3)}** | **${retrieval.overall.keywordMatchAt3}%** | **${retrieval.overall.offTopicRefusalAccuracy}%** |

### Category Breakdown (All ${retrieval.totalQueries} Queries):

| Category | Sample Size ($n$) | Hit@1 | Hit@3 | Hit@5 | MRR |
| :--- | :---: | :---: | :---: | :---: | :---: |
${catRows}

---

## 3. Full Pipeline Grounded Answer Rate & Refusal

Grounded queries evaluated through the complete stack:
$$\\text{Query} \\longrightarrow \\text{Hybrid Retrieval} \\longrightarrow \\text{Pre-LLM Cosine Gate} \\longrightarrow \\text{LLM Structured Synthesis} \\longrightarrow \\text{hasInsufficientEvidence} \\longrightarrow \\text{CitationVerifier}$$

| Split | Grounded Queries ($n$) | Real Answers Received | Wrongly Refused (False Refusals) | Answer Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Tuning Set** | ${answerRate.tuningMetrics.total} | ${answerRate.tuningMetrics.realAnswers} | ${answerRate.tuningMetrics.wronglyRefused} | **${answerRate.tuningMetrics.answerRate}%** |
| **Held-Out Set** | ${answerRate.heldOutMetrics.total} | ${answerRate.heldOutMetrics.realAnswers} | ${answerRate.heldOutMetrics.wronglyRefused} | **${answerRate.heldOutMetrics.answerRate}%** |
| **Overall Grounded** | ${answerRate.overallMetrics.total} | ${answerRate.overallMetrics.realAnswers} | ${answerRate.overallMetrics.wronglyRefused} | **${answerRate.overallMetrics.answerRate}%** |

---

## 4. Spot-Check Faithfulness Audit (10 Representative Answers)

Audited across 5 Tuning and 5 Held-Out answers spanning diverse categories:

| # | ID | Split | Category | Faithfulness Verdict | Question | Generated Answer Excerpt |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
${spotCheckRows}

---

## 5. CitationVerifier Benchmark (Tuning vs Held-Out Splits)

Evaluated against 40 hand-labeled claims (10 directly supported, 10 paraphrased, 10 completely unsupported, 10 altered numbers/metrics):

| Evaluation Set | Total Claims ($n$) | True Positives | True Negatives | False Positives | False Negatives | Accuracy | Precision | Recall | F1 Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tuning Set** (Calibrated) | ${citation.tuning.total} | ${citation.tuning.tp} | ${citation.tuning.tn} | ${citation.tuning.fp} | ${citation.tuning.fn} | **${(citation.tuning.accuracy * 100).toFixed(1)}%** | **${(citation.tuning.precision * 100).toFixed(1)}%** | **${(citation.tuning.recall * 100).toFixed(1)}%** | **${citation.tuning.f1.toFixed(3)}** |
| **Held-Out Set** (Frozen Blind) | ${citation.heldOut.total} | ${citation.heldOut.tp} | ${citation.heldOut.tn} | ${citation.heldOut.fp} | ${citation.heldOut.fn} | **${(citation.heldOut.accuracy * 100).toFixed(1)}%** | **${(citation.heldOut.precision * 100).toFixed(1)}%** | **${(citation.heldOut.recall * 100).toFixed(1)}%** | **${citation.heldOut.f1.toFixed(3)}** |
| **Combined Overall** | ${citation.combined.total} | ${citation.combined.tp} | ${citation.combined.tn} | ${citation.combined.fp} | ${citation.combined.fn} | **${(citation.combined.accuracy * 100).toFixed(1)}%** | **${(citation.combined.precision * 100).toFixed(1)}%** | **${(citation.combined.recall * 100).toFixed(1)}%** | **${citation.combined.f1.toFixed(3)}** |

---

## 6. Scanned-PDF Rule Diagnostic & Policy

1. **Hard Rejection Policy**:
   - Only triggered when machine-readable text is virtually absent: $\\text{totalChars} < 50$ or $\\text{avgCharsPerPage} < 20$.
   - Returns a clear error informing the user that OCR is required.
2. **Soft Warning Policy (Borderline Cases)**:
   - If $\\text{totalPages} \\ge 3$ and $\\text{avgCharsPerPage} < 120$ (e.g. presentation slides with single-line titles like \`basic c programs.pdf\`, 101 chars/page):
   - The document is **successfully ingested and set to \`ready\`**, but carries an amber warning flag:
     *\`Low text density detected (averaging X chars/page). Core content may be in embedded slide images; OCR recommended.\`*
   - Surfaces in the frontend UI as an informative badge.

---

## 7. Failed Grounded Retrieval Queries & Inspection (Retrieved Chunks)

${failedQueriesText}
`;
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('run_all_evals.ts');
if (isDirectRun) {
  runAllEvaluations().catch(console.error);
}
