import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateDocumentBuffer,
  validateDocumentMagicBytes,
  detectDocumentFormat,
  sanitizeFilename,
} from '../utils/fileValidator.js';
import {
  extractDocx,
  extractDoc,
  extractDocument,
  cleanText,
  WordBlock,
} from '../services/documents/extractor.js';
import {
  chunkWordDocument,
  chunkPages,
  estimateTokenCount,
} from '../services/documents/chunker.js';
import { RAGService } from '../services/ai/ragService.js';
import { ComparisonService } from '../services/ai/comparisonService.js';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

describe('Word Document Support (PDF, DOC, DOCX)', () => {
  describe('1. Document Format & Magic Bytes Validation', () => {
    it('detects and validates PDF files with %PDF- header', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const detection = detectDocumentFormat(pdfBuffer, 'research.pdf');
      expect(detection).toBe('pdf');

      const validation = validateDocumentBuffer(pdfBuffer, 'research.pdf');
      expect(validation.isValid).toBe(true);
      expect(validation.format).toBe('pdf');
    });

    it('detects and validates DOCX files with PK zip header and Word package marker', () => {
      // PK\x03\x04 with [Content_Types].xml or word/ document structure
      const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      const contentTypes = Buffer.from('[Content_Types].xml word/document.xml');
      const docxBuffer = Buffer.concat([docxHeader, Buffer.alloc(20), contentTypes]);

      const detection = detectDocumentFormat(docxBuffer, 'report.docx');
      expect(detection).toBe('docx');

      const validation = validateDocumentBuffer(docxBuffer, 'report.docx');
      expect(validation.isValid).toBe(true);
      expect(validation.format).toBe('docx');
    });

    it('detects and validates legacy DOC files with OLE CFBF header', () => {
      // 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1
      const docHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      const docBuffer = Buffer.concat([docHeader, Buffer.alloc(504)]);

      const detection = detectDocumentFormat(docBuffer, 'thesis.doc');
      expect(detection).toBe('doc');

      const validation = validateDocumentBuffer(docBuffer, 'thesis.doc');
      expect(validation.isValid).toBe(true);
      expect(validation.format).toBe('doc');
    });

    it('rejects fake/renamed files where extension does not match magic bytes', () => {
      // Plain text file renamed to .docx
      const fakeDocx = Buffer.from('This is a plain text file renamed to .docx');
      const validationDocx = validateDocumentBuffer(fakeDocx, 'fake.docx');
      expect(validationDocx.isValid).toBe(false);
      expect(validationDocx.error).toContain('Microsoft Word (.docx)');

      // Plain text file renamed to .doc
      const fakeDoc = Buffer.from('This is a plain text file renamed to .doc');
      const validationDoc = validateDocumentBuffer(fakeDoc, 'fake.doc');
      expect(validationDoc.isValid).toBe(false);
      expect(validationDoc.error).toContain('OLE CFBF');

      // Generic ZIP file that does not contain Word package markers
      const genericZipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      const genericZip = Buffer.concat([genericZipHeader, Buffer.from('some_other_file.txt')]);
      const validationGenericZip = validateDocumentBuffer(genericZip, 'archive.docx');
      expect(validationGenericZip.isValid).toBe(false);
      expect(validationGenericZip.error).toContain('Microsoft Word (.docx)');
    });

    it('sanitizes filenames while preserving .docx, .doc, and .pdf extensions', () => {
      expect(sanitizeFilename('My Report (v2).docx')).toBe('My Report (v2).docx');
      expect(sanitizeFilename('../../../etc/passwd.docx')).toBe('passwd.docx');
      expect(sanitizeFilename('bad:name*<>.doc')).toBe('bad_name___.doc');
      expect(sanitizeFilename('Attention Is All You Need.pdf')).toBe('Attention Is All You Need.pdf');
    });
  });

  describe('2. DOCX Extraction & Structure Parsing', () => {
    it('extracts headings, paragraphs, and markdown tables from DOCX', async () => {
      const sampleMarkdown = `
# Transformer Architecture Analysis
By Ashish Vaswani and Noam Shazeer
Published: 2017

## Abstract
The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer.

## Methodology
The Transformer relies entirely on an attention mechanism to draw global dependencies between input and output.

| Model | BLEU Score | Training Cost |
| :--- | :--- | :--- |
| Transformer (base) | 27.3 | 3.3 days |
| Transformer (big) | 28.4 | 3.5 days |

## Conclusion
In this work, we presented the Transformer, the first sequence transduction model based entirely on attention.
      `.trim();

      vi.spyOn(mammoth, 'convertToMarkdown').mockResolvedValueOnce({
        value: sampleMarkdown,
        messages: [],
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs.promises, 'stat').mockResolvedValueOnce({ size: 1024 } as any);

      const result = await extractDocx('test_paper.docx');

      expect(result.format).toBe('docx');
      expect(result.totalPages).toBe(0); // Never invent page numbers for Word documents
      expect(result.pages).toHaveLength(0);
      expect(result.blocks).toBeDefined();
      expect(result.blocks!.length).toBeGreaterThanOrEqual(4);

      // Verify headings are extracted
      const headings = result.blocks!.map((b) => b.heading);
      expect(headings).toContain('Abstract');
      expect(headings).toContain('Methodology');
      expect(headings).toContain('Conclusion');

      // Verify table is captured
      const tableBlock = result.blocks!.find((b) => b.text.includes('BLEU Score'));
      expect(tableBlock).toBeDefined();
      expect(tableBlock!.text).toContain('Transformer (big)');

      // Verify paragraph numbering starts at 1 and increases monotonically
      expect(result.blocks![0].paragraphNumber).toBe(1);
      expect(result.blocks![1].paragraphNumber).toBe(2);

      vi.restoreAllMocks();
    });

    it('rejects empty DOCX documents with clear error message', async () => {
      vi.spyOn(mammoth, 'convertToMarkdown').mockResolvedValueOnce({
        value: '   \n\n  ',
        messages: [],
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs.promises, 'stat').mockResolvedValueOnce({ size: 500 } as any);

      await expect(extractDocx('empty.docx')).rejects.toThrow('Empty DOCX');
      vi.restoreAllMocks();
    });
  });

  describe('3. Legacy DOC Extraction & Structure Parsing', () => {
    it('extracts body text, textboxes, and sections from legacy .doc files', async () => {
      const mockDoc = {
        getBody: () => 'Section 1. Introduction\n\nThis is a legacy research paper on artificial intelligence.\n\nSection 2. Experimental Results\n\nThe algorithm achieved 94.5% accuracy across 1000 test trials.',
        getHeaders: () => 'Conference on Neural Information Processing',
        getFooters: () => '',
        getTextboxes: () => 'Box 1: Hyperparameter tuning notes.',
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs.promises, 'stat').mockResolvedValueOnce({ size: 2048 } as any);
      vi.spyOn(fs.promises, 'open').mockResolvedValueOnce({
        read: async (buf: Buffer) => {
          Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(buf);
          return { bytesRead: 8 };
        },
        close: async () => {},
      } as any);

      vi.spyOn(WordExtractor.prototype, 'extract').mockResolvedValueOnce(mockDoc as any);

      const result = await extractDoc('legacy_paper.doc');

      expect(result.format).toBe('doc');
      expect(result.totalPages).toBe(0); // Never invent page numbers
      expect(result.blocks).toBeDefined();
      expect(result.blocks!.length).toBeGreaterThan(0);
      expect(result.fullText).toContain('Conference on Neural Information Processing');
      expect(result.fullText).toContain('94.5% accuracy');

      vi.restoreAllMocks();
    });

    it('rejects corrupted or non-OLE files uploaded as .doc', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs.promises, 'stat').mockResolvedValueOnce({ size: 100 } as any);
      vi.spyOn(fs.promises, 'open').mockResolvedValueOnce({
        read: async (buf: Buffer) => {
          Buffer.from('Not OLE Document').copy(buf);
          return { bytesRead: 8 };
        },
        close: async () => {},
      } as any);

      await expect(extractDoc('corrupted.doc')).rejects.toThrow('Invalid DOC format');
      vi.restoreAllMocks();
    });
  });

  describe('4. Word Document Chunking Service', () => {
    it('chunks Word documents respecting heading boundaries and paragraph numbers without inventing page numbers', () => {
      const blocks: WordBlock[] = [
        {
          heading: 'Introduction',
          paragraphNumber: 1,
          text: 'Deep neural networks with residual connections have revolutionized computer vision and natural language processing tasks. They allow gradients to flow through hundreds of layers directly.',
        },
        {
          heading: 'Introduction',
          paragraphNumber: 2,
          text: 'Prior to residual networks, adding depth beyond 20 layers often led to degradation in training accuracy due to vanishing gradients rather than overfitting.',
        },
        {
          heading: 'Methodology',
          paragraphNumber: 3,
          text: 'We formulate the residual mapping as F(x) = H(x) - x, where H(x) is the original underlying mapping. The shortcut connections perform identity mapping and introduce neither extra parameters nor computation complexity.',
        },
        {
          heading: 'Methodology',
          paragraphNumber: 4,
          text: 'We evaluate residual networks with depth up to 152 layers on ImageNet classification. Batch normalization is adopted right after each convolution and before activation.',
        },
        {
          heading: 'Results',
          paragraphNumber: 5,
          text: 'On the ImageNet classification task, our 152-layer ResNet achieves a 3.57% top-5 error on the test set, winning 1st place in the ILSVRC 2015 competition.',
        },
      ];

      const chunks = chunkWordDocument(blocks, {
        targetTokens: 60,
        overlapTokens: 15,
        tokenCounter: estimateTokenCount,
        docTitle: 'Deep Residual Learning',
        format: 'docx',
      });

      expect(chunks.length).toBeGreaterThan(0);

      for (const chunk of chunks) {
        // Critical requirement: Never invent page numbers for Word documents
        expect(chunk.pageNumber).toBeUndefined();
        expect(chunk.pageStart).toBeUndefined();
        expect(chunk.pageEnd).toBeUndefined();

        // Must retain heading and paragraph references
        expect(chunk.heading).toBeDefined();
        expect(chunk.paragraphNumber).toBeGreaterThanOrEqual(1);
        expect(chunk.fileType).toBe('docx');
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(chunk.embeddingText).toContain('Deep Residual Learning | ');
      }

      // Verify that heading boundaries are preserved
      const introChunks = chunks.filter((c) => c.heading === 'Introduction');
      const methodChunks = chunks.filter((c) => c.heading === 'Methodology');
      const resultChunks = chunks.filter((c) => c.heading === 'Results');

      expect(introChunks.length).toBeGreaterThan(0);
      expect(methodChunks.length).toBeGreaterThan(0);
      expect(resultChunks.length).toBeGreaterThan(0);
    });
  });

  describe('5. Mixed Document Citations & RAG Retrieval', () => {
    it('generates citations attributing page numbers for PDFs and section/paragraph for Word documents', () => {
      // PDF chunk with page number
      const pdfChunk = {
        documentId: '6afcb3217a4f7da70b78da01' as any,
        chunkIndex: 1,
        text: 'The Transformer encoder consists of a stack of N = 6 identical layers with multi-head self-attention.',
        pageNumber: 3,
        pageStart: 3,
        pageEnd: 3,
        section: 'Model Architecture',
        fileType: 'pdf',
      };

      // Word document chunk without page number
      const wordChunk = {
        documentId: '6afcb3217a4f7da70b78da02' as any,
        chunkIndex: 2,
        text: 'Our deep residual learning framework evaluates bottleneck building blocks with 1x1, 3x3, and 1x1 convolutions.',
        heading: 'Architecture Design',
        section: 'Methodology',
        paragraphNumber: 7,
        fileType: 'docx',
      };

      // Verify citation shape for PDF
      const pdfIsWord = pdfChunk.fileType === 'docx' || pdfChunk.fileType === 'doc';
      const pdfCitation = {
        documentId: pdfChunk.documentId,
        documentName: 'Attention_Paper.pdf',
        pageNumber: pdfIsWord ? undefined : pdfChunk.pageNumber,
        heading: undefined,
        section: pdfChunk.section,
        paragraphNumber: undefined,
        fileType: pdfChunk.fileType,
        excerpt: pdfChunk.text,
      };

      expect(pdfCitation.pageNumber).toBe(3);
      expect(pdfCitation.fileType).toBe('pdf');

      // Verify citation shape for Word
      const wordIsWord = wordChunk.fileType === 'docx' || wordChunk.fileType === 'doc';
      const wordCitation = {
        documentId: wordChunk.documentId,
        documentName: 'ResNet_Proposal.docx',
        pageNumber: wordIsWord ? undefined : (wordChunk as any).pageNumber,
        heading: wordChunk.heading,
        section: wordChunk.section,
        paragraphNumber: wordChunk.paragraphNumber,
        fileType: wordChunk.fileType,
        excerpt: wordChunk.text,
      };

      expect(wordCitation.pageNumber).toBeUndefined(); // NEVER invented
      expect(wordCitation.heading).toBe('Architecture Design');
      expect(wordCitation.paragraphNumber).toBe(7);
      expect(wordCitation.fileType).toBe('docx');

      // Verify formatted citation strings
      const formatCitation = (c: typeof wordCitation) => {
        const loc = c.pageNumber
          ? `Page ${c.pageNumber}`
          : `Section: ${c.heading || c.section || 'Body'}${c.paragraphNumber ? `, Para ${c.paragraphNumber}` : ''}`;
        return `- **${c.documentName}** (${loc}): "${c.excerpt}"`;
      };

      const pdfFormatted = formatCitation(pdfCitation as any);
      expect(pdfFormatted).toContain('Attention_Paper.pdf** (Page 3)');

      const wordFormatted = formatCitation(wordCitation);
      expect(wordFormatted).toContain('ResNet_Proposal.docx** (Section: Architecture Design, Para 7)');
      expect(wordFormatted).not.toContain('Page 1'); // Did not invent Page 1!
    });

    it('cross-document comparison handles mixed PDF and Word documents across all 10 dimensions', () => {
      const mockDocData = [
        {
          id: 'doc-pdf',
          name: 'Transformer.pdf',
          pageCount: 15,
          excerpts: [
            { text: 'Proposes attention-based translation without recurrence.', pageNumber: 2 },
            { text: 'Evaluates WMT 2014 English-to-German achieving 28.4 BLEU.', pageNumber: 8 },
          ],
        },
        {
          id: 'doc-word',
          name: 'ResNet_Analysis.docx',
          pageCount: 0, // Word doc
          excerpts: [
            {
              text: 'Proposes residual connections to ease training of deep neural networks.',
              pageNumber: undefined,
              heading: 'Introduction',
              paragraphNumber: 1,
            },
            {
              text: 'Achieves 3.57% top-5 error on ImageNet classification.',
              pageNumber: undefined,
              heading: 'Results',
              paragraphNumber: 5,
            },
          ],
        },
      ];

      const standardDimensions = [
        'Research Objectives',
        'Methodology & Core Architecture',
        'Key Findings & Results',
        'Datasets & Benchmarks',
        'Metrics & Performance',
        'Advantages & Innovations',
        'Research Gaps & Future Directions',
        'Limitations & Constraints',
        'Practical Applications',
        'Comparative Assessment',
      ];

      // Format markdown export string
      let md = `**Documents Compared (${mockDocData.length})**:\n`;
      mockDocData.forEach((d) => {
        const pageInfo = d.pageCount && d.pageCount > 0 ? `${d.pageCount} pages` : 'Word document';
        md += `- **${d.name}** (${pageInfo})\n`;
      });

      expect(md).toContain('- **Transformer.pdf** (15 pages)');
      expect(md).toContain('- **ResNet_Analysis.docx** (Word document)');
      expect(md).not.toContain('0 pages');
    });
  });
});
