import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PdfViewerModal } from '../components/common/PdfViewerModal.js';
import { SourceCitation } from '../components/chat/SourceCitation.js';
import { ChatMessage } from '../components/chat/ChatMessage.js';
import { DocumentCard } from '../components/documents/DocumentCard.js';
import { ComparisonTable } from '../components/research/ComparisonTable.js';
import { IDocument } from '../types/document.js';
import { IChatMessage, ICitation, ComparisonResult } from '../types/research.js';

describe('Frontend Component Tests: PdfViewerModal', () => {
  it('renders modal with target page number and document title', () => {
    const handleClose = vi.fn();
    const { container } = render(
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

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute('src', '/api/documents/doc123/file#page=4');

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

    // Degraded banner
    expect(screen.getByText(/Synthesis Degraded Mode/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Model quota exceeded; synthesized from grounded excerpts./i)
    ).toBeInTheDocument();

    // Export button
    expect(screen.getByTitle('Export response to Markdown (.md)')).toBeInTheDocument();
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
    expect(screen.getByText('22')).toBeInTheDocument();
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
    render(<ComparisonTable comparison={sampleComparison} />);

    expect(screen.getByText(/Focus: "Parameter Efficiency"/i)).toBeInTheDocument();
    expect(screen.getByText(/Degraded \/ Grounded Fallback Answer/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Comparison timeout exceeded; fallback extracted from citations./i)
    ).toBeInTheDocument();

    expect(screen.getByText('Research Objective')).toBeInTheDocument();
    expect(screen.getByText('Eliminate recurrent connections.')).toBeInTheDocument();
    expect(screen.getByText('Reduce trainable parameters in fine-tuning.')).toBeInTheDocument();

    expect(screen.getByTitle('Export complete comparison to Markdown (.md)')).toBeInTheDocument();
  });
});
