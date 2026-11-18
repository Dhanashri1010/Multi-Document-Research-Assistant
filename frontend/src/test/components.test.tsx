import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PdfViewerModal } from '../components/common/PdfViewerModal.js';
import { SourceCitation } from '../components/chat/SourceCitation.js';
import { ChatMessage } from '../components/chat/ChatMessage.js';
import { DocumentCard } from '../components/documents/DocumentCard.js';
import { ComparisonTable, sanitizeDegradedReason } from '../components/research/ComparisonTable.js';
import { IDocument } from '../types/document.js';
import { IChatMessage, ICitation, ComparisonResult } from '../types/research.js';
import { documentService } from '../services/documentService.js';

describe('Frontend Component Tests: PdfViewerModal', () => {
  it('renders modal with target page number and document title using secure blob URL', async () => {
    vi.spyOn(documentService, 'getFileBlob').mockResolvedValue(
      new Blob(['fake-pdf-stream'], { type: 'application/pdf' })
    );

    const handleClose = vi.fn();
    render(
      <PdfViewerModal
        isOpen={true}
        onClose={handleClose}
        documentId="doc123"
        documentName="Attention_Is_All_You_Need.pdf"
        pageNumber={4}
      />
    );

    expect(screen.getByText('Attention_Is_All_You_Need.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Page 4/i)).toBeInTheDocument();

    const iframe = await screen.findByTestId('pdf-viewer-iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', expect.stringMatching(/^blob:.*#page=4$/));
    expect(iframe.getAttribute('src')).not.toContain('token=');

    const closeBtn = screen.getByTitle('Close PDF viewer');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <PdfViewerModal
        isOpen={false}
        onClose={vi.fn()}
        documentId="doc123"
        documentName="Attention.pdf"
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('Frontend Component Tests: SourceCitation', () => {
  const sampleCitations: ICitation[] = [
    {
      documentId: 'doc1',
      documentName: 'Paper 1 - Attention',
      pageNumber: 3,
      excerpt: 'The Transformer achieves 28.4 BLEU on English-to-German.',
      verified: true,
      supportScore: 0.92,
    },
    {
      documentId: 'doc2',
      documentName: 'Paper 2 - LoRA',
      pageNumber: 5,
      excerpt: 'LoRA reduces trainable parameters by 10,000 times.',
      verified: false,
      supportScore: 0.22,
    },
  ];

  it('renders verified and unverified badges correctly', () => {
    render(<SourceCitation citations={sampleCitations} />);

    expect(screen.getByText(/Retrieved Evidence & Citations \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1 unverified citation flagged/i)).toBeInTheDocument();

    expect(screen.getByText('verified')).toBeInTheDocument();
    expect(screen.getByText('unverified')).toBeInTheDocument();
  });

  it('expands citation excerpt and shows Open in PDF Viewer button upon click', () => {
    render(<SourceCitation citations={sampleCitations} />);

    // Click first citation card to expand
    const firstDoc = screen.getByText('Paper 1 - Attention');
    fireEvent.click(firstDoc);

    expect(screen.getByText(/Open in PDF Viewer at Page 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy Citation/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy Passage/i)).toBeInTheDocument();
  });

  it('renders exact highlighted supporting spans and referenced claim when available', () => {
    const verifiedWithSpans: ICitation[] = [
      {
        documentId: 'doc_rag',
        documentName: 'RAG_Paper.pdf',
        pageNumber: 4,
        excerpt: 'We present RAG models. Retrieval-Augmented Generation outperforms parametric models on Open-Domain QA.',
        highlightSpans: ['Retrieval-Augmented Generation outperforms parametric models on Open-Domain QA.'],
        claim: 'RAG models outperform standard parametric seq2seq models on open-domain question answering.',
        verified: true,
        verificationReason: 'Supporting evidence found in the cited passage.',
      },
    ];

    render(<SourceCitation citations={verifiedWithSpans} />);

    const docHeader = screen.getByText('RAG_Paper.pdf');
    fireEvent.click(docHeader);

    expect(screen.getByText(/Referenced Claim/i)).toBeInTheDocument();
    expect(
      screen.getByText(/"RAG models outperform standard parametric seq2seq models on open-domain question answering."/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Highlighted sentence supports claim/i)).toBeInTheDocument();

    // The highlighted span should be wrapped in a mark element
    const markEl = document.querySelector('mark');
    expect(markEl).toBeInTheDocument();
    expect(markEl?.textContent).toContain('Retrieval-Augmented Generation outperforms parametric models');
  });

  it('correctly handles and displays not checked citation state when unverified by AI', () => {
    const uncheckCitations: ICitation[] = [
      {
        documentId: 'doc3',
        documentName: 'Paper 3 - Raw Excerpt',
        pageNumber: 2,
        excerpt: 'Direct excerpt retrieved from vector store.',
        verified: undefined,
      },
    ];

    render(<SourceCitation citations={uncheckCitations} />);

    expect(screen.getByText(/sources not checked/i)).toBeInTheDocument();
    expect(screen.getByText('not checked')).toBeInTheDocument();
  });
});

describe('Frontend Component Tests: ChatMessage', () => {
  const sampleMessage: IChatMessage = {
    sessionId: 'sess_1',
    role: 'assistant',
    content: 'The Transformer architecture relies entirely on self-attention.',
    citations: [
      {
        documentId: 'doc1',
        documentName: 'Attention Is All You Need',
        pageNumber: 1,
        excerpt: 'We propose the Transformer, a model architecture eschewing recurrence.',
        verified: true,
      },
    ],
    degraded: true,
    degradedReason: 'Model quota exceeded; synthesized from grounded excerpts.',
    createdAt: new Date().toISOString(),
  };

  it('renders assistant response, degraded notice, and markdown export button', () => {
    render(<ChatMessage message={sampleMessage} />);

    expect(
      screen.getByText('The Transformer architecture relies entirely on self-attention.')
    ).toBeInTheDocument();

    // Degraded banner (updated to student-friendly format)
    expect(screen.getByText(/AI-generated summary is temporarily unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Model quota exceeded; synthesized from grounded excerpts./i)
    ).toBeInTheDocument();

    // Export button
    expect(screen.getByTitle('Export response to Markdown (.md)')).toBeInTheDocument();
  });

  it('cleans raw JSON from content and renders table and formatted elements', () => {
    const rawJsonMessage: IChatMessage = {
      sessionId: 'sess_123',
      role: 'assistant',
      content: JSON.stringify({
        hasInsufficientEvidence: false,
        answer: '### Methodology Comparison\n\n| Paper | Method |\n| :--- | :--- |\n| Attention | Self-Attention |\n\n1. First point\n- Bullet point',
        claims: [{ claim: 'Self-attention replaces recurrence', sourceIndices: [1] }],
      }),
      citations: [],
      createdAt: '2026-11-18T00:00:00Z',
    };

    render(<ChatMessage message={rawJsonMessage} />);

    // Should NOT display raw JSON internal fields
    expect(screen.queryByText(/hasInsufficientEvidence/i)).toBeNull();
    expect(screen.queryByText(/sourceIndices/i)).toBeNull();

    // Should render clean headings and table content
    expect(screen.getByText('Methodology Comparison')).toBeInTheDocument();
    expect(screen.getByText('Self-Attention')).toBeInTheDocument();
    expect(screen.getByText('First point')).toBeInTheDocument();
    expect(screen.getByText('Bullet point')).toBeInTheDocument();
  });

  it('sanitizes raw JSON parsing errors in degradedReason', () => {
    const rawErrorMsg: IChatMessage = {
      sessionId: 'sess_deg_1',
      role: 'assistant',
      content: 'Passage text extracted directly from document.',
      citations: [],
      degraded: true,
      degradedReason: 'JSON parsing failed (Unterminated string in JSON at position 7203 (line 167 column 47))',
      createdAt: '2026-11-18T00:00:00Z',
    };

    render(<ChatMessage message={rawErrorMsg} />);

    expect(screen.queryByText(/JSON parsing failed/i)).toBeNull();
    expect(screen.queryByText(/position 7203/i)).toBeNull();
    expect(screen.getByText(/The AI model response was interrupted during generation/i)).toBeInTheDocument();
  });

  it('renders interactive inline citation buttons and opens evidence card on click', () => {
    const inlineCiteMsg: IChatMessage = {
      _id: 'msg_inline_1',
      sessionId: 'sess_1',
      role: 'assistant',
      content: 'Transformers replace recurrence with multi-head attention [1].',
      citations: [
        {
          documentId: 'doc1',
          documentName: 'Attention Is All You Need.pdf',
          pageNumber: 2,
          excerpt: 'We propose multi-head attention to jointly attend to information.',
          verified: true,
          verificationReason: 'Supporting evidence found in the cited passage.',
        },
      ],
      createdAt: '2026-11-18T00:00:00Z',
    };

    render(<ChatMessage message={inlineCiteMsg} />);

    const inlineBtn = screen.getByText('[1]');
    expect(inlineBtn).toBeInTheDocument();
    expect(inlineBtn.tagName).toBe('BUTTON');

    // Click inline citation button to expand evidence card
    fireEvent.click(inlineBtn);

    expect(
      screen.getByText('We propose multi-head attention to jointly attend to information.')
    ).toBeInTheDocument();
  });
});

describe('Frontend Component Tests: DocumentCard', () => {
  const sampleDoc: IDocument = {
    _id: 'doc_abc',
    originalName: 'Scanned_Paper_Analysis.pdf',
    filename: 'file_abc.pdf',
    filePath: '/uploads/file_abc.pdf',
    fileSize: 4 * 1024 * 1024,
    mimeType: 'application/pdf',
    pageCount: 15,
    chunkCount: 22,
    status: 'ready',
    collectionName: 'Transformers',
    isLowTextDensity: true,
    warning: 'Low text density detected. OCR recommended for scanned pages.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders collection tag, pages/chunks metrics, and low text density notice', () => {
    render(
      <MemoryRouter>
        <DocumentCard
          document={sampleDoc}
          isSelected={false}
          onToggleSelect={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onReprocess={vi.fn().mockResolvedValue(undefined)}
          onSummarize={vi.fn()}
          onOpenResearch={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Scanned_Paper_Analysis.pdf')).toBeInTheDocument();
    expect(screen.getByText('Transformers')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('4.00 MB')).toBeInTheDocument();
    expect(screen.getByText(/Low text density · OCR recommended/i)).toBeInTheDocument();
  });
});

describe('Frontend Component Tests: ComparisonTable', () => {
  const sampleComparison: ComparisonResult = {
    documents: [
      { id: 'doc1', name: 'Attention Is All You Need', pageCount: 11 },
      { id: 'doc2', name: 'LoRA', pageCount: 14 },
    ],
    focusTopic: 'Parameter Efficiency',
    matrix: [
      {
        dimension: 'Research Objective',
        values: [
          {
            documentId: 'doc1',
            documentName: 'Attention Is All You Need',
            finding: 'Eliminate recurrent connections.',
            pageNumber: 1,
          },
          {
            documentId: 'doc2',
            documentName: 'LoRA',
            finding: 'Reduce trainable parameters in fine-tuning.',
            pageNumber: 1,
          },
        ],
      },
    ],
    similarities: ['Both evaluate on natural language understanding tasks.'],
    differences: ['Attention is a base model; LoRA is an adaptation method.'],
    keyFindings: ['Significant parameter and latency savings.'],
    limitations: ['Context window constraints.'],
    citations: [],
    degraded: true,
    degradedReason: 'Comparison timeout exceeded; fallback extracted from citations.',
  };

  it('renders comparative matrix, degraded banner, and export button', () => {
    const onRetry = vi.fn();
    render(<ComparisonTable comparison={sampleComparison} onRetry={onRetry} />);

    expect(screen.getByText(/Focus: "Parameter Efficiency"/i)).toBeInTheDocument();
    expect(screen.getByText(/Passage-Grounded Fallback Analysis/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Comparison timeout exceeded; fallback extracted from citations./i)
    ).toBeInTheDocument();

    expect(screen.getByText('Research Objective')).toBeInTheDocument();
    expect(screen.getByText('Eliminate recurrent connections.')).toBeInTheDocument();
    expect(screen.getByText('Reduce trainable parameters in fine-tuning.')).toBeInTheDocument();

    expect(screen.getByTitle('Export complete comparison to Markdown (.md)')).toBeInTheDocument();
    expect(screen.getByText(/Retry Comparison/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Retry Comparison/i));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sanitizes raw JSON parsing errors into clean user-facing messages', () => {
    const rawError = 'JSON parsing failed (Unterminated string in JSON at position 7203 (line 167 column 47))';
    const cleaned = sanitizeDegradedReason(rawError);

    expect(cleaned).not.toContain('JSON');
    expect(cleaned).not.toContain('Unterminated');
    expect(cleaned).not.toContain('position 7203');
    expect(cleaned).toContain('The AI model response was interrupted');
  });
});
