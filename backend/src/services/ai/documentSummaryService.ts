import { DocumentModel, IDocument } from '../../models/Document.js';
import { DocumentChunkModel } from '../../models/DocumentChunk.js';
import { LLMService } from './llmService.js';
import { ICitation } from '../../models/ChatMessage.js';

export type DocumentCategory =
  | 'Research Paper'
  | 'Academic Article'
  | 'Technical Document'
  | 'Business Report'
  | 'Educational Material'
  | 'Legal Document'
  | 'User Manual'
  | 'General Document';

export interface FindingWithPage {
  finding: string;
  pageNumber?: number;
}

export interface MetricWithPage {
  metric: string;
  value: string;
  context?: string;
  pageNumber?: number;
}

export interface SummarySection {
  title: string;
  content?: string;
  items?: string[];
  pageNumber?: number;
}

export interface StructuredDocumentSummary {
  category: DocumentCategory;
  overview: string;
  sections: SummarySection[];
  keyFindings: FindingWithPage[];
  importantData?: MetricWithPage[];
  methodology?: string;
  limitations?: string;
  conclusion?: string;
  legalDisclaimer?: string;
  citations: ICitation[];
  generatedAt: string;
  degraded?: boolean;
  degradedReason?: string;
  // Backward compatibility fields for existing UI/API callers
  summary: string;
  keyFindingsStrings: string[];
}

/**
 * Heuristically detects the document category from text and metadata.
 */
export function detectDocumentCategory(
  sampleText: string,
  title?: string,
  abstract?: string
): DocumentCategory {
  const combined = `${title || ''} ${abstract || ''} ${sampleText}`.toLowerCase();

  // Legal Document patterns
  if (
    combined.includes('agreement') ||
    combined.includes('contract') ||
    combined.includes('terms of service') ||
    combined.includes('parties hereto') ||
    combined.includes('indemnification') ||
    combined.includes('governing law') ||
    combined.includes('herein') ||
    combined.includes('confidentiality agreement')
  ) {
    return 'Legal Document';
  }

  // User Manual patterns
  if (
    combined.includes('user manual') ||
    combined.includes('user guide') ||
    combined.includes('operating instructions') ||
    combined.includes('installation guide') ||
    combined.includes('troubleshooting guide') ||
    (combined.includes('instructions') && combined.includes('precautions'))
  ) {
    return 'User Manual';
  }

  // Business Report patterns
  if (
    combined.includes('annual report') ||
    combined.includes('quarterly report') ||
    combined.includes('fiscal year') ||
    combined.includes('balance sheet') ||
    combined.includes('revenue') && (combined.includes('ebitda') || combined.includes('q1') || combined.includes('q2') || combined.includes('q3') || combined.includes('q4')) ||
    combined.includes('executive summary') && combined.includes('market share')
  ) {
    return 'Business Report';
  }

  // Educational Material patterns
  if (
    combined.includes('syllabus') ||
    combined.includes('lecture notes') ||
    combined.includes('course outline') ||
    combined.includes('homework assignment') ||
    combined.includes('learning objectives') ||
    (combined.includes('chapter') && combined.includes('exercises'))
  ) {
    return 'Educational Material';
  }

  // Research Paper / Academic Article patterns
  if (
    combined.includes('abstract') &&
    (combined.includes('references') ||
      combined.includes('arxiv') ||
      combined.includes('ieee') ||
      combined.includes('proceedings') ||
      combined.includes('methodology') ||
      combined.includes('related work') ||
      combined.includes('doi:'))
  ) {
    return 'Research Paper';
  }

  // Technical Document patterns
  if (
    combined.includes('api reference') ||
    combined.includes('system architecture') ||
    combined.includes('datasheet') ||
    combined.includes('specification') ||
    combined.includes('protocol') ||
    combined.includes('software requirements')
  ) {
    return 'Technical Document';
  }

  return 'General Document';
}

/**
 * Converts structured summary data into clean, formatted Markdown.
 */
export function formatSummaryAsMarkdown(summary: StructuredDocumentSummary, docTitle: string): string {
  const lines: string[] = [];
  lines.push(`# Document Summary: ${docTitle}`);
  lines.push(`**Category:** ${summary.category}  `);
  lines.push(`**Generated:** ${new Date(summary.generatedAt).toLocaleString()}  `);
  lines.push('');

  lines.push('## Overview');
  lines.push(summary.overview);
  lines.push('');

  if (summary.keyFindings && summary.keyFindings.length > 0) {
    lines.push('## Key Findings');
    for (const f of summary.keyFindings) {
      const pageTag = f.pageNumber ? ` *(Page ${f.pageNumber})*` : '';
      lines.push(`- ${f.finding}${pageTag}`);
    }
    lines.push('');
  }

  for (const s of summary.sections) {
    lines.push(`## ${s.title}`);
    if (s.content) {
      lines.push(s.content);
      lines.push('');
    }
    if (s.items && s.items.length > 0) {
      for (const item of s.items) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
  }

  if (summary.importantData && summary.importantData.length > 0) {
    lines.push('## Quantitative Data & Key Metrics');
    lines.push('| Metric / Topic | Value / Finding | Source Page |');
    lines.push('| :--- | :--- | :--- |');
    for (const d of summary.importantData) {
      const ctx = d.context ? ` (${d.context})` : '';
      const p = d.pageNumber ? `Page ${d.pageNumber}` : '—';
      lines.push(`| ${d.metric}${ctx} | **${d.value}** | ${p} |`);
    }
    lines.push('');
  }

  if (summary.methodology) {
    lines.push('## Methodology');
    lines.push(summary.methodology);
    lines.push('');
  }

  if (summary.limitations) {
    lines.push('## Limitations & Considerations');
    lines.push(summary.limitations);
    lines.push('');
  }

  if (summary.conclusion) {
    lines.push('## Conclusion');
    lines.push(summary.conclusion);
    lines.push('');
  }

  if (summary.legalDisclaimer) {
    lines.push('> [!NOTE]');
    lines.push(`> ${summary.legalDisclaimer}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Intelligent extractive fallback when LLM is unavailable or times out.
 */
function buildExtractiveFallback(
  doc: IDocument,
  chunks: any[],
  category: DocumentCategory,
  errorMessage: string
): StructuredDocumentSummary {
  // Extract sentences with basic filtering
  const sentencesWithPages: { text: string; pageNumber: number }[] = [];
  for (const c of chunks) {
    const rawSentences = c.text
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length >= 35 && s.length <= 220);

    for (const s of rawSentences) {
      if (
        !s.toLowerCase().includes('copyright') &&
        !s.toLowerCase().includes('all rights reserved') &&
        !s.toLowerCase().includes('et al') &&
        !s.toLowerCase().includes('figure') &&
        !s.toLowerCase().includes('table')
      ) {
        sentencesWithPages.push({ text: s, pageNumber: c.pageNumber });
      }
    }
  }

  const overview =
    doc.abstract ||
    (sentencesWithPages.length > 0
      ? sentencesWithPages.slice(0, 2).map((s) => s.text).join(' ')
      : `This document contains ${doc.pageCount} pages and covers core topics related to ${doc.originalName}.`);

  const keyFindings: FindingWithPage[] = sentencesWithPages
    .slice(2, 6)
    .map((s) => ({ finding: s.text, pageNumber: s.pageNumber }));

  // Find numerical facts
  const importantData: MetricWithPage[] = [];
  const numberRegex = /\b(\d+(?:\.\d+)?%|\d+\s*(?:ms|seconds|minutes|GB|MB|samples|parameters|tokens|million|billion))\b/i;
  for (const item of sentencesWithPages) {
    const match = item.text.match(numberRegex);
    if (match && importantData.length < 4) {
      importantData.push({
        metric: item.text.slice(0, 60) + '...',
        value: match[0],
        pageNumber: item.pageNumber,
      });
    }
  }

  const citations: ICitation[] = chunks.slice(0, 3).map((c) => ({
    documentId: doc._id,
    documentName: doc.originalName,
    pageNumber: c.pageNumber,
    excerpt: c.text.length > 250 ? c.text.slice(0, 250) + '...' : c.text,
  }));

  const structured: StructuredDocumentSummary = {
    category,
    overview,
    sections: [
      {
        title: 'Core Concepts & Topics',
        items: keyFindings.map((f) => f.finding),
      },
    ],
    keyFindings,
    importantData: importantData.length > 0 ? importantData : undefined,
    methodology: 'Extracted directly from document content passages.',
    limitations: 'Full detailed breakdown is based on the indexed document text.',
    conclusion: 'This document provides structured insights across the indexed pages.',
    legalDisclaimer:
      category === 'Legal Document'
        ? 'Notice: This summary is generated for informational purposes only and does not constitute legal advice.'
        : undefined,
    citations,
    generatedAt: new Date().toISOString(),
    degraded: true,
    degradedReason: `Summary synthesized directly from document text (${errorMessage})`,
    summary: overview,
    keyFindingsStrings: keyFindings.map((f) => f.finding),
  };

  return structured;
}

export class DocumentSummaryService {
  /**
   * Retrieves an existing cached summary or generates an intelligent adaptive summary.
   */
  static async getOrGenerateSummary(
    documentId: string,
    regenerate: boolean = false
  ): Promise<StructuredDocumentSummary> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      throw new Error('Document not found');
    }
    if (doc.status !== 'ready') {
      throw new Error(`Document is not ready for summarization (current status: "${doc.status}").`);
    }

    // Return cached summary if present and regeneration was not requested
    if (!regenerate && doc.summaryData && doc.summaryData.overview) {
      return {
        ...doc.summaryData,
        summary: doc.summaryData.summary || doc.summaryData.overview,
        keyFindingsStrings:
          doc.summaryData.keyFindingsStrings ||
          (doc.summaryData.keyFindings || []).map((f: any) =>
            typeof f === 'string' ? f : f.finding
          ),
      };
    }

    // Fetch document chunks for summarization
    const chunks = await DocumentChunkModel.find({ documentId: doc._id })
      .sort({ chunkIndex: 1 })
      .lean();

    if (chunks.length === 0) {
      throw new Error('No readable chunks found for this document.');
    }

    // Exclude references from the candidate context
    const nonRefChunks = chunks.filter(
      (c) =>
        c.section !== 'References' &&
        !c.text.trim().toLowerCase().startsWith('references')
    );
    const candidateChunks = nonRefChunks.length > 0 ? nonRefChunks : chunks;

    // Detect document category
    const initialCategory =
      doc.category && doc.category !== 'General Document'
        ? (doc.category as DocumentCategory)
        : detectDocumentCategory(
            candidateChunks.slice(0, 3).map((c) => c.text).join(' '),
            doc.title || doc.originalName,
            doc.abstract
          );

    // Select representative chunks: front-matter/intro, middle, conclusions
    const selectedChunks: typeof candidateChunks = [];
    if (candidateChunks.length <= 6) {
      selectedChunks.push(...candidateChunks);
    } else {
      // First 2 chunks (title, abstract, intro)
      selectedChunks.push(candidateChunks[0]);
      if (candidateChunks.length > 1) selectedChunks.push(candidateChunks[1]);
      // 2 middle chunks
      const mid = Math.floor(candidateChunks.length / 2);
      selectedChunks.push(candidateChunks[mid - 1]);
      selectedChunks.push(candidateChunks[mid]);
      // Last 2 chunks (results, discussion, conclusion)
      selectedChunks.push(candidateChunks[candidateChunks.length - 2]);
      selectedChunks.push(candidateChunks[candidateChunks.length - 1]);
    }

    const citations: ICitation[] = selectedChunks.map((c) => ({
      documentId: doc._id,
      documentName: doc.originalName,
      pageNumber: c.pageNumber,
      excerpt: c.text.length > 250 ? c.text.slice(0, 250) + '...' : c.text,
    }));

    const excerptsText = selectedChunks
      .map((c) => `[Page ${c.pageNumber}]\n${c.text.trim()}`)
      .join('\n\n---\n\n');

    const cleanTitle = doc.title || doc.originalName.replace(/\.pdf$/i, '');

    const systemPrompt = `You are an expert document research assistant and science communicator.
Your role is to produce a high-quality, professional, and accessible document summary for an audience of college students, professors, researchers, working professionals, and business users.

COMMUNICATION PRINCIPLES:
1. Balanced tone: Neither overly simplified nor excessively academic. Preserve critical technical terminology, equations/methods, and numerical facts, while clearly explaining complex concepts.
2. Grounded accuracy: Synthesize ONLY from the provided document excerpts. Never invent metrics, findings, or conclusions.
3. Concise & High-density: Avoid introductory fluff ("This paper provides...", "Here is a summary...", "In summary"). State findings and insights directly.
4. Source Attribution: Where a finding, metric, or concept appears on a specific page, cite that page number using the integer provided in "[Page X]" markers.
5. Structure Adaptation: Choose the single most accurate category from:
   - "Research Paper"
   - "Academic Article"
   - "Technical Document"
   - "Business Report"
   - "Educational Material"
   - "Legal Document"
   - "User Manual"
   - "General Document"
   Adapt the summary sections to the document's actual domain. Do not create empty sections.

OUTPUT FORMAT: Strict JSON only with the following structure:
{
  "category": "Research Paper | Academic Article | Technical Document | Business Report | Educational Material | Legal Document | User Manual | General Document",
  "overview": "A clear, compelling 1-2 paragraph overview explaining what the document is about, what core problem it addresses, and why it matters.",
  "keyFindings": [
    { "finding": "Precise finding statement", "pageNumber": 1 }
  ],
  "sections": [
    {
      "title": "Main Concepts / Architecture / Purpose / Important Clauses",
      "content": "Paragraph explanation",
      "items": ["Specific point 1", "Specific point 2"],
      "pageNumber": 2
    }
  ],
  "importantData": [
    { "metric": "Metric or evaluated benchmark", "value": "Exact numerical value or percentage", "context": "Context or baseline comparison", "pageNumber": 3 }
  ],
  "methodology": "Clear explanation of how the work was done or structured (omit or null if not applicable)",
  "limitations": "Explicit limitations, caveats, or boundary conditions stated in the text (omit or null if not mentioned)",
  "conclusion": "The concluding takeaway or practical significance",
  "legalDisclaimer": "Include only if Legal Document"
}`;

    const userPrompt = `DOCUMENT TITLE: "${cleanTitle}"
DETECTED PRELIMINARY CATEGORY: ${initialCategory}

DOCUMENT EXCERPTS (WITH PAGE NUMBERS):
${excerptsText}

Generate the comprehensive structured JSON summary now.`;

    try {
      const response = await LLMService.generate(userPrompt, {
        systemPrompt,
        temperature: 0.1,
        timeoutMs: 18000,
        maxRetries: 1,
      });

      const cleanJson = response.replace(/^```json/m, '').replace(/^```/m, '').trim();
      const parsed = JSON.parse(cleanJson);

      const category: DocumentCategory = parsed.category || initialCategory;
      const overview: string = parsed.overview || doc.abstract || 'Overview extracted from document content.';

      const keyFindings: FindingWithPage[] = Array.isArray(parsed.keyFindings)
        ? parsed.keyFindings.map((f: any) =>
            typeof f === 'string' ? { finding: f, pageNumber: undefined } : f
          )
        : [];

      const sections: SummarySection[] = Array.isArray(parsed.sections) ? parsed.sections : [];

      const importantData: MetricWithPage[] = Array.isArray(parsed.importantData)
        ? parsed.importantData
        : [];

      const methodology: string | undefined = parsed.methodology || undefined;
      const limitations: string | undefined = parsed.limitations || undefined;
      const conclusion: string | undefined = parsed.conclusion || undefined;
      const legalDisclaimer: string | undefined =
        category === 'Legal Document'
          ? parsed.legalDisclaimer ||
            'Notice: This AI-generated summary is for informational purposes only and does not constitute legal advice.'
          : undefined;

      const structuredSummary: StructuredDocumentSummary = {
        category,
        overview,
        sections,
        keyFindings,
        importantData: importantData.length > 0 ? importantData : undefined,
        methodology,
        limitations,
        conclusion,
        legalDisclaimer,
        citations,
        generatedAt: new Date().toISOString(),
        degraded: false,
        summary: overview,
        keyFindingsStrings: keyFindings.map((f) => f.finding),
      };

      const markdownText = formatSummaryAsMarkdown(structuredSummary, cleanTitle);

      // Save summary and category to document record in database
      await DocumentModel.findByIdAndUpdate(doc._id, {
        category,
        summaryData: structuredSummary,
        summaryText: markdownText,
      });

      return structuredSummary;
    } catch (err: any) {
      console.warn(`[DocumentSummaryService] LLM synthesis failed for "${doc.originalName}":`, err.message);

      const fallback = buildExtractiveFallback(doc, candidateChunks, initialCategory, err.message);
      const markdownText = formatSummaryAsMarkdown(fallback, cleanTitle);

      // Save fallback summary to document record
      await DocumentModel.findByIdAndUpdate(doc._id, {
        category: initialCategory,
        summaryData: fallback,
        summaryText: markdownText,
      });

      return fallback;
    }
  }
}
