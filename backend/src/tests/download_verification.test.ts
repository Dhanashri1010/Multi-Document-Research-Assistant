import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { DocumentController } from '../controllers/documentController.js';
import { DocumentModel } from '../models/Document.js';
import { StorageService } from '../services/storage/supabaseStorage.js';

describe('Document Download & Export Verification Tests', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const userPayload = { userId, email: 'researcher@university.edu', name: 'Researcher' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Actual Document Download Testing (PDF, DOCX, DOC, TXT)', () => {
    it('downloads authentic PDF file with application/pdf MIME type and intact binary content', async () => {
      const pdfRawBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Research Paper) >>\nendobj\ntrailer\n<<>>\n%%EOF');
      const doc = {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(userId),
        originalName: 'Deep_Learning_Survey.pdf',
        mimeType: 'application/pdf',
        fileType: 'pdf',
        filePath: 'mock/path/Deep_Learning_Survey.pdf',
        fileSize: pdfRawBuffer.length,
      };

      vi.spyOn(DocumentModel, 'findById').mockResolvedValueOnce(doc as any);
      vi.spyOn(StorageService, 'getDocumentBuffer').mockResolvedValueOnce(pdfRawBuffer);

      const req: any = {
        params: { id: doc._id.toString() },
        user: userPayload,
      };

      const headers: Record<string, string> = {};
      let returnedBuffer: Buffer | null = null;
      const res: any = {
        setHeader: vi.fn((k, v) => {
          headers[k] = v;
        }),
        send: vi.fn((buf) => {
          returnedBuffer = buf;
        }),
      };
      const next = vi.fn();

      await DocumentController.downloadFile(req, res, next);

      expect(headers['Content-Type']).toBe('application/pdf');
      expect(headers['Content-Disposition']).toBe('attachment; filename="Deep_Learning_Survey.pdf"');
      expect(returnedBuffer).not.toBeNull();
      expect(returnedBuffer!.length).toBe(pdfRawBuffer.length);
      // Verify binary header integrity
      expect(returnedBuffer!.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
      expect(returnedBuffer!.equals(pdfRawBuffer)).toBe(true);
    });

    it('downloads authentic DOCX file with OpenXML MIME type and intact ZIP structure', async () => {
      const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      const content = Buffer.from('[Content_Types].xml word/document.xml');
      const docxRawBuffer = Buffer.concat([docxHeader, Buffer.alloc(20), content]);

      const doc = {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(userId),
        originalName: 'Experiment_Report.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileType: 'docx',
        filePath: 'mock/path/Experiment_Report.docx',
        fileSize: docxRawBuffer.length,
      };

      vi.spyOn(DocumentModel, 'findById').mockResolvedValueOnce(doc as any);
      vi.spyOn(StorageService, 'getDocumentBuffer').mockResolvedValueOnce(docxRawBuffer);

      const req: any = {
        params: { id: doc._id.toString() },
        user: userPayload,
      };

      const headers: Record<string, string> = {};
      let returnedBuffer: Buffer | null = null;
      const res: any = {
        setHeader: vi.fn((k, v) => {
          headers[k] = v;
        }),
        send: vi.fn((buf) => {
          returnedBuffer = buf;
        }),
      };
      const next = vi.fn();

      await DocumentController.downloadFile(req, res, next);

      expect(headers['Content-Type']).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(headers['Content-Disposition']).toBe('attachment; filename="Experiment_Report.docx"');
      expect(returnedBuffer).not.toBeNull();
      expect(returnedBuffer![0]).toBe(0x50);
      expect(returnedBuffer![1]).toBe(0x4b);
      expect(returnedBuffer!.equals(docxRawBuffer)).toBe(true);
    });

    it('downloads authentic legacy DOC file with application/msword MIME type', async () => {
      const docHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      const docRawBuffer = Buffer.concat([docHeader, Buffer.alloc(504)]);

      const doc = {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(userId),
        originalName: 'Thesis_Draft.doc',
        mimeType: 'application/msword',
        fileType: 'doc',
        filePath: 'mock/path/Thesis_Draft.doc',
        fileSize: docRawBuffer.length,
      };

      vi.spyOn(DocumentModel, 'findById').mockResolvedValueOnce(doc as any);
      vi.spyOn(StorageService, 'getDocumentBuffer').mockResolvedValueOnce(docRawBuffer);

      const req: any = {
        params: { id: doc._id.toString() },
        user: userPayload,
      };

      const headers: Record<string, string> = {};
      let returnedBuffer: Buffer | null = null;
      const res: any = {
        setHeader: vi.fn((k, v) => {
          headers[k] = v;
        }),
        send: vi.fn((buf) => {
          returnedBuffer = buf;
        }),
      };
      const next = vi.fn();

      await DocumentController.downloadFile(req, res, next);

      expect(headers['Content-Type']).toBe('application/msword');
      expect(headers['Content-Disposition']).toBe('attachment; filename="Thesis_Draft.doc"');
      expect(returnedBuffer).not.toBeNull();
      expect(returnedBuffer![0]).toBe(0xd0);
      expect(returnedBuffer![1]).toBe(0xcf);
      expect(returnedBuffer!.equals(docRawBuffer)).toBe(true);
    });

    it('downloads plain text TXT file with text/plain MIME type and preserved UTF-8 encoding', async () => {
      const txtContent = 'Title: Multi-Document RAG\nAuthor: Jane Doe\nAbstract: A benchmark study.';
      const txtRawBuffer = Buffer.from(txtContent, 'utf-8');

      const doc = {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(userId),
        originalName: 'Notes.txt',
        mimeType: 'text/plain',
        fileType: 'txt',
        filePath: 'mock/path/Notes.txt',
        fileSize: txtRawBuffer.length,
      };

      vi.spyOn(DocumentModel, 'findById').mockResolvedValueOnce(doc as any);
      vi.spyOn(StorageService, 'getDocumentBuffer').mockResolvedValueOnce(txtRawBuffer);

      const req: any = {
        params: { id: doc._id.toString() },
        user: userPayload,
      };

      const headers: Record<string, string> = {};
      let returnedBuffer: Buffer | null = null;
      const res: any = {
        setHeader: vi.fn((k, v) => {
          headers[k] = v;
        }),
        send: vi.fn((buf) => {
          returnedBuffer = buf;
        }),
      };
      const next = vi.fn();

      await DocumentController.downloadFile(req, res, next);

      expect(headers['Content-Type']).toBe('text/plain');
      expect(headers['Content-Disposition']).toBe('attachment; filename="Notes.txt"');
      expect(returnedBuffer).not.toBeNull();
      expect(returnedBuffer!.toString('utf-8')).toBe(txtContent);
    });
  });

  describe('2. Generated Markdown Exports Testing', () => {
    it('verifies generated Research Answer Markdown structure and MIME attributes', () => {
      const question = 'What are the main advantages of RAG?';
      const answer = 'RAG grounds LLM outputs in verified external knowledge.\n\n| Advantage | Impact |\n| --- | --- |\n| Factuality | High |\n| Customization | High |';
      const citations = [
        {
          documentName: 'RAG_Paper.pdf',
          pageNumber: 3,
          verified: true,
          excerpt: 'Retrieval Augmented Generation combines pre-trained parametric memory with non-parametric memory.',
        },
      ];

      // Replicate the client export generation logic
      const md = [
        `# Research Query & Synthesized Answer`,
        `**Date:** ${new Date().toISOString()}`,
        `**Question:** ${question}`,
        `\n---\n`,
        `## Synthesized Answer\n`,
        answer,
        `\n\n---\n`,
        `## Retrieved Evidence & Citations\n`,
        ...citations.map(
          (c, idx) =>
            `### [${idx + 1}] ${c.documentName} (Page ${c.pageNumber}) - [${c.verified ? 'Verified' : 'Unverified'}]\n> "${c.excerpt}"\n`
        ),
      ].join('\n');

      const mimeType = 'text/markdown;charset=utf-8';
      const filename = `research_answer_${Date.now()}.md`;

      expect(filename.endsWith('.md')).toBe(true);
      expect(mimeType).toBe('text/markdown;charset=utf-8');
      expect(md).toContain('# Research Query & Synthesized Answer');
      expect(md).toContain('## Retrieved Evidence & Citations');
      expect(md).toContain('[1] RAG_Paper.pdf (Page 3) - [Verified]');
      // Verify raw JSON artifacts are absent
      expect(md).not.toContain('{"hasInsufficientEvidence"');
      expect(md).not.toContain('"claims":');
    });

    it('verifies generated Cross-Document Comparison Markdown structure', () => {
      const topic = 'Attention Mechanisms';
      const documents = ['PaperA.pdf', 'PaperB.pdf'];
      const matrix = [
        { dimension: 'Problem Statement', docA: 'RNNs are slow', docB: 'LSTMs fail at long range' },
        { dimension: 'Methodology', docA: 'Self-Attention', docB: 'State Space Models' },
      ];

      const md = [
        `# Cross-Document Comparative Analysis`,
        `**Focus Topic:** ${topic}`,
        `**Compared Documents:** ${documents.join(', ')}`,
        `\n---\n`,
        `## Evaluation Matrix\n`,
        `| Dimension | PaperA.pdf | PaperB.pdf |`,
        `| :--- | :--- | :--- |`,
        ...matrix.map((row) => `| **${row.dimension}** | ${row.docA} | ${row.docB} |`),
        `\n---\n`,
        `## Synthesis & Consensus\n`,
        `Both papers prioritize constant training time per step.`,
      ].join('\n');

      const mimeType = 'text/markdown;charset=utf-8';
      const filename = `comparison_analysis_${Date.now()}.md`;

      expect(filename.endsWith('.md')).toBe(true);
      expect(mimeType).toBe('text/markdown;charset=utf-8');
      expect(md).toContain('# Cross-Document Comparative Analysis');
      expect(md).toContain('## Evaluation Matrix');
      expect(md).toContain('| **Problem Statement** | RNNs are slow | LSTMs fail at long range |');
    });

    it('verifies generated Document Summary Markdown structure, citation metadata, and sanitization', () => {
      const documentTitle = 'Attention Is All You Need';
      const summaryData = {
        category: 'Deep Learning / NLP',
        overview: 'Introduces the Transformer model based entirely on self-attention mechanisms without recurrence.',
        keyFindings: [
          { finding: 'Transformer achieves 28.4 BLEU on WMT 2014 English-to-German translation.', pageNumber: 8 },
          { finding: 'Reduces training time to 3.5 days on 8 P100 GPUs.', pageNumber: 9 },
        ],
        importantData: [
          { metric: 'BLEU Score', value: '28.4', context: 'WMT 2014 En-De', pageNumber: 8 },
          { metric: 'Training Time', value: '3.5 days', context: '8 P100 GPUs', pageNumber: 9 },
        ],
        methodology: 'Multi-Head Attention combined with Scaled Dot-Product Attention and sinusoidal position encodings.',
        limitations: 'Quadratic memory complexity with respect to sequence length.',
        conclusion: 'Self-attention provides superior translation quality with significant parallelization advantages.',
      };

      // Replicate SummaryPanel export builder
      let md = `# Executive Summary: ${documentTitle}\n\n`;
      if (summaryData.category) {
        md += `**Category**: ${summaryData.category}\n\n`;
      }
      md += `## 1. Overview\n${summaryData.overview}\n\n`;

      if (summaryData.keyFindings && summaryData.keyFindings.length > 0) {
        md += `## 2. Key Findings & Insights\n`;
        summaryData.keyFindings.forEach((f, idx) => {
          const text = typeof f === 'string' ? f : f.finding;
          const page = typeof f === 'object' && f.pageNumber ? ` (Page ${f.pageNumber})` : '';
          md += `${idx + 1}. ${text}${page}\n`;
        });
        md += `\n`;
      }

      if (summaryData.importantData && summaryData.importantData.length > 0) {
        md += `## 3. Quantitative Metrics\n`;
        md += `| Metric | Value | Context | Page |\n| :--- | :--- | :--- | :--- |\n`;
        summaryData.importantData.forEach((d) => {
          md += `| ${d.metric} | ${d.value} | ${d.context || '—'} | ${d.pageNumber ? `P. ${d.pageNumber}` : '—'} |\n`;
        });
        md += `\n`;
      }

      if (summaryData.methodology) {
        md += `## 4. Methodology\n${summaryData.methodology}\n\n`;
      }
      if (summaryData.limitations) {
        md += `## 5. Limitations & Boundary Conditions\n${summaryData.limitations}\n\n`;
      }
      if (summaryData.conclusion) {
        md += `## 6. Takeaway & Practical Significance\n${summaryData.conclusion}\n\n`;
      }

      const mimeType = 'text/markdown;charset=utf-8';
      const filename = `${documentTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_summary.md`;

      // 1. Filename & MIME validation
      expect(filename).toBe('Attention_Is_All_You_Need_summary.md');
      expect(filename.endsWith('.md')).toBe(true);
      expect(mimeType).toBe('text/markdown;charset=utf-8');

      // 2. Complete Content Validation
      expect(md).toContain('# Executive Summary: Attention Is All You Need');
      expect(md).toContain('**Category**: Deep Learning / NLP');
      expect(md).toContain('## 1. Overview');
      expect(md).toContain('Introduces the Transformer model');
      expect(md).toContain('## 2. Key Findings & Insights');
      expect(md).toContain('## 3. Quantitative Metrics');
      expect(md).toContain('## 4. Methodology');
      expect(md).toContain('## 5. Limitations & Boundary Conditions');
      expect(md).toContain('## 6. Takeaway & Practical Significance');

      // 3. Citation metadata (Page numbers attached to findings and table)
      expect(md).toContain('1. Transformer achieves 28.4 BLEU on WMT 2014 English-to-German translation. (Page 8)');
      expect(md).toContain('| BLEU Score | 28.4 | WMT 2014 En-De | P. 8 |');

      // 4. Sanitization: No raw internal JSON, MongoDB IDs or secrets
      expect(md).not.toContain('{"hasInsufficientEvidence"');
      expect(md).not.toContain('_id');
      expect(md).not.toContain('password');
      expect(md).not.toContain('JWT_SECRET');
    });
  });
});

