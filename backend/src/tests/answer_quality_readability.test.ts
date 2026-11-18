import { describe, it, expect, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  detectQuestionIntent,
  extractCleanAnswer,
  stripDuplicateCitationsList,
  RAGService,
} from '../services/ai/ragService.js';
import { DocumentModel } from '../models/Document.js';
import { ResearchSessionModel } from '../models/ResearchSession.js';
import { ChatMessageModel } from '../models/ChatMessage.js';
import { LLMService } from '../services/ai/llmService.js';

describe('Answer Quality & Readability: Intent Detection', () => {
  it('accurately identifies question intent for the 6 required question formats', () => {
    // 1. Summarize main findings
    expect(detectQuestionIntent('Summarize the main findings across these papers.')).toBe('findings');
    expect(detectQuestionIntent('What is the main contribution of this research?')).toBe('findings');
    expect(detectQuestionIntent('What are the key findings?')).toBe('findings');

    // 2. Compare methodologies
    expect(detectQuestionIntent('Compare the methodologies used in these documents.')).toBe('methodology');
    expect(detectQuestionIntent('Explain the methodology in simple language.')).toBe('methodology');
    expect(detectQuestionIntent('How does the method work?')).toBe('methodology');

    // 3. Limitations
    expect(detectQuestionIntent('What limitations are reported by the authors?')).toBe('limitations');
    expect(detectQuestionIntent('What are the limitations of this study?')).toBe('limitations');

    // 4. Compare conclusions
    expect(detectQuestionIntent('What differences exist between the conclusions of these papers?')).toBe('conclusions');
    expect(detectQuestionIntent('Compare the conclusions across these papers.')).toBe('conclusions');

    // 5. General research question
    expect(detectQuestionIntent('What learning rate was used during training?')).toBe('general');
  });
});

describe('Answer Quality & Readability: Resilient JSON & Content Cleaning', () => {
  it('extracts clean answer from strict valid JSON and strips internal fields', () => {
    const raw = JSON.stringify({
      hasInsufficientEvidence: false,
      insufficientReason: null,
      answer: '**Main Findings**\n\n1. Finding one [Doc.pdf, p. 1]\n2. Finding two [Doc.pdf, p. 2]',
      claims: [{ claim: 'Finding one', sourceIndices: [1] }],
    });

    const result = extractCleanAnswer(raw);
    expect(result.answer).toContain('**Main Findings**');
    expect(result.answer).not.toContain('hasInsufficientEvidence');
    expect(result.answer).not.toContain('sourceIndices');
    expect(result.hasInsufficientEvidence).toBe(false);
  });

  it('resiliently extracts answer even when JSON contains literal unescaped newlines', () => {
    // Malformed JSON that breaks standard JSON.parse due to literal unescaped newlines inside string literal
    const malformedRaw = `{\n  "hasInsufficientEvidence": false,\n  "answer": "**Methodology Comparison**\n\n- Research Approach: Empirical analysis\n- Algorithms: Attention",\n  "claims": []\n}`;

    const result = extractCleanAnswer(malformedRaw);
    expect(result.answer).toContain('Methodology Comparison');
    expect(result.answer).toContain('Research Approach: Empirical analysis');
    expect(result.answer).not.toContain('"claims"');
  });

  it('strips redundant duplicate references lists from the end of the answer', () => {
    const answerWithAppendedReferences =
      `**Main Findings**\n\n1. Point one [Doc.pdf, p. 2]\n\n### References\n1. [Doc.pdf, p. 2] Excerpt text\n2. [Doc.pdf, p. 4] Excerpt text`;

    const cleaned = stripDuplicateCitationsList(answerWithAppendedReferences);
    expect(cleaned).toContain('Point one [Doc.pdf, p. 2]');
    expect(cleaned).not.toContain('### References');
    expect(cleaned).not.toContain('Excerpt text');
  });

  it('handles plain text responses directly without corruption', () => {
    const plain = 'The Transformer architecture replaces recurrence with multi-head self-attention [Attention.pdf, p. 1].';
    const result = extractCleanAnswer(plain);
    expect(result.answer).toBe(plain);
    expect(result.hasInsufficientEvidence).toBe(false);
  });
});

import { config } from '../config/env.js';

describe('Answer Quality & Readability: End-to-End Pipeline Formats', () => {
  it('generates properly formatted answer for Summarize Main Findings with mock LLM', async () => {
    const originalProvider = config.llmProvider;
    (config as any).llmProvider = 'mock';

    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      originalName: 'Attention Is All You Need.pdf',
      status: 'ready',
      chunkCount: 6,
    });

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue([fakeDoc] as any);
    const sessionSpy = vi.spyOn(ResearchSessionModel, 'create').mockResolvedValue({
      _id: new Types.ObjectId(),
      save: vi.fn(),
    } as any);

    const msgFindSpy = vi.spyOn(ChatMessageModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
    const msgFindOneSpy = vi.spyOn(ChatMessageModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as any);
    const msgCreateSpy = vi.spyOn(ChatMessageModel, 'create').mockResolvedValue({} as any);

    const fakeEmbedder = { embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.1)) };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const vectorSpy = vi.spyOn(await import('../services/ai/vectorStore.js').then((m) => m.VectorStore), 'search').mockResolvedValue([
      {
        chunk: {
          _id: new Types.ObjectId(),
          documentId: docId,
          text: 'The Transformer replaces recurrent layers with multi-head self-attention mechanisms.',
          pageNumber: 2,
          section: 'Architecture',
        } as any,
        score: 0.88,
        denseScore: 0.88,
      },
    ]);

    try {
      const res = await RAGService.ask({
        question: 'Summarize the main findings across these papers.',
        documentIds: [docId.toString()],
      });

      expect(res.answer).toContain('**Main Findings**');
      expect(res.answer).toContain('**Overall Conclusion**');
      expect(res.answer).not.toContain('hasInsufficientEvidence');
      expect(res.answer).not.toContain('sourceIndices');
      expect(res.answer).not.toContain('{"answer":');
    } finally {
      (config as any).llmProvider = originalProvider;
      docSpy.mockRestore();
      sessionSpy.mockRestore();
      msgFindSpy.mockRestore();
      msgFindOneSpy.mockRestore();
      msgCreateSpy.mockRestore();
      embedSpy.mockRestore();
      vectorSpy.mockRestore();
    }
  });

  it('generates properly formatted answer for Methodology Comparison with markdown table', async () => {
    const originalProvider = config.llmProvider;
    (config as any).llmProvider = 'mock';

    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      originalName: 'Attention Is All You Need.pdf',
      status: 'ready',
      chunkCount: 8,
    });

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue([fakeDoc] as any);
    const sessionSpy = vi.spyOn(ResearchSessionModel, 'create').mockResolvedValue({
      _id: new Types.ObjectId(),
      save: vi.fn(),
    } as any);

    const msgFindSpy = vi.spyOn(ChatMessageModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
    const msgFindOneSpy = vi.spyOn(ChatMessageModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as any);
    const msgCreateSpy = vi.spyOn(ChatMessageModel, 'create').mockResolvedValue({} as any);

    const fakeEmbedder = { embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.1)) };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const vectorSpy = vi.spyOn(await import('../services/ai/vectorStore.js').then((m) => m.VectorStore), 'search').mockResolvedValue([
      {
        chunk: {
          _id: new Types.ObjectId(),
          documentId: docId,
          text: 'Scaled Dot-Product Attention computes query-key dot products divided by sqrt(d_k).',
          pageNumber: 4,
          section: 'Methodology',
        } as any,
        score: 0.86,
        denseScore: 0.86,
      },
    ]);

    try {
      const res = await RAGService.ask({
        question: 'Compare the methodologies used in these documents.',
        documentIds: [docId.toString()],
      });

      expect(res.answer).toContain('**Methodology Comparison**');
      expect(res.answer).toContain('| Paper | Research Approach |');
      expect(res.answer).not.toContain('{"answer":');
      expect(res.answer).not.toContain('hasInsufficientEvidence');
    } finally {
      (config as any).llmProvider = originalProvider;
      docSpy.mockRestore();
      sessionSpy.mockRestore();
      msgFindSpy.mockRestore();
      msgFindOneSpy.mockRestore();
      msgCreateSpy.mockRestore();
      embedSpy.mockRestore();
      vectorSpy.mockRestore();
    }
  });

  it('generates properly formatted answer for Reported Limitations without speculation', async () => {
    const originalProvider = config.llmProvider;
    (config as any).llmProvider = 'mock';

    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      originalName: 'Attention Is All You Need.pdf',
      status: 'ready',
      chunkCount: 7,
    });

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue([fakeDoc] as any);
    const sessionSpy = vi.spyOn(ResearchSessionModel, 'create').mockResolvedValue({
      _id: new Types.ObjectId(),
      save: vi.fn(),
    } as any);

    const msgFindSpy = vi.spyOn(ChatMessageModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
    const msgFindOneSpy = vi.spyOn(ChatMessageModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as any);
    const msgCreateSpy = vi.spyOn(ChatMessageModel, 'create').mockResolvedValue({} as any);

    const fakeEmbedder = { embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.1)) };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const vectorSpy = vi.spyOn(await import('../services/ai/vectorStore.js').then((m) => m.VectorStore), 'search').mockResolvedValue([
      {
        chunk: {
          _id: new Types.ObjectId(),
          documentId: docId,
          text: 'Computational complexity per layer scales quadratically with sequence length n.',
          pageNumber: 6,
          section: 'Complexity',
        } as any,
        score: 0.84,
        denseScore: 0.84,
      },
    ]);

    try {
      const res = await RAGService.ask({
        question: 'What limitations are reported by the authors?',
        documentIds: [docId.toString()],
      });

      expect(res.answer).toContain('**Reported Limitations**');
      expect(res.answer).toContain('quadratically');
      expect(res.answer).not.toContain('{"answer":');
      expect(res.answer).not.toContain('hasInsufficientEvidence');
    } finally {
      (config as any).llmProvider = originalProvider;
      docSpy.mockRestore();
      sessionSpy.mockRestore();
      msgFindSpy.mockRestore();
      msgFindOneSpy.mockRestore();
      msgCreateSpy.mockRestore();
      embedSpy.mockRestore();
      vectorSpy.mockRestore();
    }
  });

  it('generates properly formatted answer for Comparison of Conclusions', async () => {
    const originalProvider = config.llmProvider;
    (config as any).llmProvider = 'mock';

    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      originalName: 'Attention Is All You Need.pdf',
      status: 'ready',
      chunkCount: 7,
    });

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue([fakeDoc] as any);
    const sessionSpy = vi.spyOn(ResearchSessionModel, 'create').mockResolvedValue({
      _id: new Types.ObjectId(),
      save: vi.fn(),
    } as any);

    const msgFindSpy = vi.spyOn(ChatMessageModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
    const msgFindOneSpy = vi.spyOn(ChatMessageModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as any);
    const msgCreateSpy = vi.spyOn(ChatMessageModel, 'create').mockResolvedValue({} as any);

    const fakeEmbedder = { embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.1)) };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const vectorSpy = vi.spyOn(await import('../services/ai/vectorStore.js').then((m) => m.VectorStore), 'search').mockResolvedValue([
      {
        chunk: {
          _id: new Types.ObjectId(),
          documentId: docId,
          text: 'In this work, we presented the Transformer, the first sequence transduction model based entirely on attention.',
          pageNumber: 10,
          section: 'Conclusion',
        } as any,
        score: 0.89,
        denseScore: 0.89,
      },
    ]);

    try {
      const res = await RAGService.ask({
        question: 'What differences exist between the conclusions of these papers?',
        documentIds: [docId.toString()],
      });

      expect(res.answer).toContain('**Comparison of Conclusions**');
      expect(res.answer).toContain('**Similarities**');
      expect(res.answer).toContain('**Differences**');
      expect(res.answer).toContain('**Main Takeaway**');
      expect(res.answer).not.toContain('{"answer":');
      expect(res.answer).not.toContain('hasInsufficientEvidence');
    } finally {
      (config as any).llmProvider = originalProvider;
      docSpy.mockRestore();
      sessionSpy.mockRestore();
      msgFindSpy.mockRestore();
      msgFindOneSpy.mockRestore();
      msgCreateSpy.mockRestore();
      embedSpy.mockRestore();
      vectorSpy.mockRestore();
    }
  });

  it('generates properly formatted answer for Main Contribution question', async () => {
    const originalProvider = config.llmProvider;
    (config as any).llmProvider = 'mock';

    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      originalName: 'Attention Is All You Need.pdf',
      status: 'ready',
      chunkCount: 10,
    });

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue([fakeDoc] as any);
    const sessionSpy = vi.spyOn(ResearchSessionModel, 'create').mockResolvedValue({
      _id: new Types.ObjectId(),
      save: vi.fn(),
    } as any);

    const msgFindSpy = vi.spyOn(ChatMessageModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
    const msgFindOneSpy = vi.spyOn(ChatMessageModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as any);
    const msgCreateSpy = vi.spyOn(ChatMessageModel, 'create').mockResolvedValue({} as any);

    const fakeEmbedder = { embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.1)) };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const vectorSpy = vi.spyOn(await import('../services/ai/vectorStore.js').then((m) => m.VectorStore), 'search').mockResolvedValue([
      {
        chunk: {
          _id: new Types.ObjectId(),
          documentId: docId,
          text: 'The main contribution is proposing the Transformer, replacing recurrence with multi-head attention.',
          pageNumber: 2,
          section: 'Introduction',
        } as any,
        score: 0.87,
        denseScore: 0.87,
      },
    ]);

    try {
      const res = await RAGService.ask({
        question: 'What is the main contribution of this research?',
        documentIds: [docId.toString()],
      });

      expect(res.answer).toContain('**Main Findings**');
      expect(res.answer).toContain('**Overall Conclusion**');
      expect(res.answer).not.toContain('{"answer":');
      expect(res.answer).not.toContain('hasInsufficientEvidence');
    } finally {
      (config as any).llmProvider = originalProvider;
      docSpy.mockRestore();
      sessionSpy.mockRestore();
      msgFindSpy.mockRestore();
      msgFindOneSpy.mockRestore();
      msgCreateSpy.mockRestore();
      embedSpy.mockRestore();
      vectorSpy.mockRestore();
    }
  });

  it('generates degraded mode message cleanly without raw JSON when LLM fails', async () => {
    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      originalName: 'Neural Networks.pdf',
      status: 'ready',
      chunkCount: 5,
    });

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue([fakeDoc] as any);
    const sessionSpy = vi.spyOn(ResearchSessionModel, 'create').mockResolvedValue({
      _id: new Types.ObjectId(),
      save: vi.fn(),
    } as any);

    const msgFindSpy = vi.spyOn(ChatMessageModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
    const msgFindOneSpy = vi.spyOn(ChatMessageModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as any);
    const msgCreateSpy = vi.spyOn(ChatMessageModel, 'create').mockResolvedValue({} as any);

    const fakeEmbedder = { embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.1)) };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const vectorSpy = vi.spyOn(await import('../services/ai/vectorStore.js').then((m) => m.VectorStore), 'search').mockResolvedValue([
      {
        chunk: {
          _id: new Types.ObjectId(),
          documentId: docId,
          text: 'Backpropagation computes the gradient of the loss function with respect to weights.',
          pageNumber: 3,
          section: 'Optimization',
        } as any,
        score: 0.85,
        denseScore: 0.85,
      },
    ]);

    const llmSpy = vi.spyOn(LLMService, 'generate').mockRejectedValue(new Error('503 Service Overloaded'));

    const res = await RAGService.ask({
      question: 'How does backpropagation work in this network?',
      documentIds: [docId.toString()],
    });

    expect(res.degraded).toBe(true);
    expect(res.answer).toContain('AI-generated summary is temporarily unavailable');
    expect(res.answer).toContain('Backpropagation computes the gradient');
    expect(res.answer).not.toContain('{"hasInsufficientEvidence"');

    docSpy.mockRestore();
    sessionSpy.mockRestore();
    msgFindSpy.mockRestore();
    msgFindOneSpy.mockRestore();
    msgCreateSpy.mockRestore();
    embedSpy.mockRestore();
    vectorSpy.mockRestore();
    llmSpy.mockRestore();
  });
});
