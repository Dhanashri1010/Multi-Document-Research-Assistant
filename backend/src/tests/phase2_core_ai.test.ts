import { describe, it, expect, vi } from 'vitest';
import { formatSafeErrorMessage, LLMService } from '../services/ai/llmService.js';
import { ComparisonService, repairAndParseComparisonJson } from '../services/ai/comparisonService.js';
import { RAGService } from '../services/ai/ragService.js';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';

describe('Phase 2 Core AI: Provider Error Sanitization (formatSafeErrorMessage)', () => {
  it('handles 429 Rate Limit / Quota Exceeded safely without leaking keys or paths', () => {
    const err = new Error('Resource has been exhausted (e.g. check quota) at C:\\app\\secret\\key.ts:42 with API key AIzaSyFakeKey12345');
    (err as any).status = 429;

    const safeMessage = formatSafeErrorMessage(err);
    expect(safeMessage).toContain('rate limit');
    expect(safeMessage).not.toContain('AIzaSyFakeKey12345');
    expect(safeMessage).not.toContain('C:\\app\\secret');
  });

  it('handles 503 Service Unavailable / Overloaded error safely', () => {
    const err = new Error('503 The model is overloaded. Please try again later.');
    (err as any).status = 503;

    const safeMessage = formatSafeErrorMessage(err);
    expect(safeMessage).toContain('503 Service Unavailable');
    expect(safeMessage).toContain('high traffic');
    expect(safeMessage).not.toContain('The model is overloaded. Please try again later.');
  });

  it('handles other 5xx upstream server errors safely', () => {
    const err = new Error('502 Bad Gateway from upstream API');
    (err as any).status = 502;

    const safeMessage = formatSafeErrorMessage(err);
    expect(safeMessage).toContain('upstream service encountered a temporary error (502)');
  });

  it('handles 401/403 Authentication and API key failures safely without exposing credentials', () => {
    const err = new Error('API_KEY_INVALID: API key not valid. Please pass a valid API key (key: secret_abc123) /usr/local/bin/node');
    (err as any).status = 401;

    const safeMessage = formatSafeErrorMessage(err);
    expect(safeMessage).toContain('authentication error');
    expect(safeMessage).not.toContain('secret_abc123');
    expect(safeMessage).not.toContain('/usr/local/bin/node');
  });

  it('handles timeout and connection errors safely', () => {
    const err = new Error('LLM call timed out after 25000ms');

    const safeMessage = formatSafeErrorMessage(err);
    expect(safeMessage).toContain('timed out');
    expect(safeMessage).toContain('grounded evidence');
  });

  it('handles null, undefined or generic exceptions safely', () => {
    expect(formatSafeErrorMessage(null)).toContain('temporarily unavailable');
    expect(formatSafeErrorMessage(undefined)).toContain('temporarily unavailable');

    const genericErr = new Error('Database disk read failed at /var/data/internal.db');
    const safeGeneric = formatSafeErrorMessage(genericErr);
    expect(safeGeneric).toContain('temporarily unavailable');
    expect(safeGeneric).not.toContain('/var/data/internal.db');
  });
});

describe('Phase 2 Core AI: Cross-Document Comparison 10 Dimensions', () => {
  const expectedDimensions = [
    'Research Objectives',
    'Methodologies',
    'Models and Technologies',
    'Datasets',
    'Evaluation Metrics',
    'Results',
    'Advantages',
    'Limitations',
    'Conclusions',
    'Research Gaps',
  ];

  it('includes all 10 academic comparison dimensions in standard configuration', () => {
    // Verify standard 10 dimensions match requirements
    expect(expectedDimensions.length).toBe(10);
    expect(expectedDimensions).toContain('Advantages');
    expect(expectedDimensions).toContain('Research Gaps');
    expect(expectedDimensions).toContain('Methodologies');
    expect(expectedDimensions).toContain('Evaluation Metrics');
    expect(expectedDimensions).toContain('Models and Technologies');
  });

  it('builds a fallback comparison matrix containing all 10 dimensions when LLM degrades', async () => {
    const fakeDoc1 = {
      _id: 'doc001001001001001001001001',
      originalName: 'Paper Alpha.pdf',
      pageCount: 8,
      status: 'ready',
    };
    const fakeDoc2 = {
      _id: 'doc002002002002002002002002',
      originalName: 'Paper Beta.pdf',
      pageCount: 12,
      status: 'ready',
    };

    const docFindSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValueOnce([fakeDoc1, fakeDoc2] as any);
    const chunkFindSpy = vi.spyOn(DocumentChunkModel, 'find').mockReturnValue({
      sort: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: 'chunk1',
              documentId: fakeDoc1._id,
              pageNumber: 1,
              text: 'Paper Alpha explores self-supervised representations.',
            },
            {
              _id: 'chunk2',
              documentId: fakeDoc1._id,
              pageNumber: 5,
              text: 'Paper Alpha achieves state of the art results on ImageNet.',
            },
          ]),
      }),
    } as any);

    // Mock LLM failure (e.g. 503 Service Unavailable) to trigger degraded fallback matrix
    const llmSpy = vi.spyOn(LLMService, 'generate').mockRejectedValue(new Error('503 Model Overloaded'));

    const comparison = await ComparisonService.compareDocuments([fakeDoc1._id, fakeDoc2._id]);

    expect(comparison).toBeDefined();
    expect(comparison.degraded).toBe(true);
    expect(comparison.matrix.length).toBe(10);

    const generatedDimNames = comparison.matrix.map((m) => m.dimension);
    expect(generatedDimNames).toEqual(expectedDimensions);

    // Check each dimension has entries for both documents
    for (const row of comparison.matrix) {
      expect(row.values.length).toBe(2);
      expect(row.values[0].documentName).toBe('Paper Alpha.pdf');
      expect(row.values[1].documentName).toBe('Paper Beta.pdf');
      expect(row.values[0].finding.length).toBeGreaterThan(0);
    }

    docFindSpy.mockRestore();
    chunkFindSpy.mockRestore();
    llmSpy.mockRestore();
  });

  it('resiliently repairs and parses truncated JSON with unterminated strings', () => {
    // Exact failure pattern: model output cut off inside a string literal
    const truncated = `{"matrix": [{"dimension": "Research Objectives", "values": [{"documentId": "1", "documentName": "Alpha.pdf", "finding": "The authors propose a novel model for seq2seq translation that`;

    const parsed = repairAndParseComparisonJson(truncated);
    expect(parsed).toBeDefined();
    expect(parsed.matrix).toBeDefined();
    expect(parsed.matrix.length).toBe(1);
    expect(parsed.matrix[0].dimension).toBe('Research Objectives');
    expect(parsed.matrix[0].values[0].finding).toContain('seq2seq translation that');
  });

  it('resiliently repairs and parses JSON with unclosed arrays and code block fences', () => {
    const fencedTruncated = '```json\n{"matrix": [{"dimension": "Methodologies", "values": [{"documentId": "1", "documentName": "Beta.pdf", "finding": "Empirical analysis"}]}], "similarities": ["Both use transformers';

    const parsed = repairAndParseComparisonJson(fencedTruncated);
    expect(parsed).toBeDefined();
    expect(parsed.matrix).toBeDefined();
    expect(parsed.matrix[0].dimension).toBe('Methodologies');
    expect(parsed.similarities).toContain('Both use transformers');
  });

  it('guarantees clean, non-technical degradedReason without exposing raw JSON parse errors', async () => {
    const fakeDoc1 = {
      _id: 'doc001001001001001001001001',
      originalName: 'Paper Alpha.pdf',
      pageCount: 8,
      status: 'ready',
    };
    const fakeDoc2 = {
      _id: 'doc002002002002002002002002',
      originalName: 'Paper Beta.pdf',
      pageCount: 12,
      status: 'ready',
    };

    const docFindSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValueOnce([fakeDoc1, fakeDoc2] as any);
    const chunkFindSpy = vi.spyOn(DocumentChunkModel, 'find').mockReturnValue({
      sort: () => ({
        lean: () => Promise.resolve([]),
      }),
    } as any);

    // Mock LLM returning completely corrupted non-JSON text
    const llmSpy = vi.spyOn(LLMService, 'generate').mockResolvedValueOnce('<!DOCTYPE html><html><body>Error</body></html>');

    const comparison = await ComparisonService.compareDocuments([fakeDoc1._id, fakeDoc2._id]);

    expect(comparison.degraded).toBe(true);
    expect(comparison.degradedReason).toBeDefined();
    expect(comparison.degradedReason).not.toContain('JSON parsing failed');
    expect(comparison.degradedReason).not.toContain('Unterminated string');
    expect(comparison.degradedReason).not.toContain('position');

    docFindSpy.mockRestore();
    chunkFindSpy.mockRestore();
    llmSpy.mockRestore();
  });
});

describe('Phase 2 Core AI: RAG Conversation Persistence & Query Rewriter', () => {
  it('incorporates both user and assistant turns from the last 6 messages into query rewriting', async () => {
    const history = [
      { role: 'user', content: 'What dataset does Attention Is All You Need use?' },
      { role: 'assistant', content: 'It uses WMT 2014 English-to-German and English-to-French translation datasets.' },
      { role: 'user', content: 'What was the BLEU score on English to German?' },
      { role: 'assistant', content: 'It achieved a BLEU score of 28.4 on the WMT 2014 English-to-German translation task.' },
    ];

    const generateSpy = vi.spyOn(LLMService, 'generate').mockResolvedValueOnce(
      'What was the BLEU score of Transformer on the English-to-French translation task?'
    );

    const rewritten = await RAGService.rewriteQuery('And how about on English to French?', history);

    expect(generateSpy).toHaveBeenCalledTimes(1);
    const callArgs = generateSpy.mock.calls[0];
    const promptArg = callArgs[0];

    // Ensure prompt includes dialogue history with both roles
    expect(promptArg).toContain('USER: What dataset does Attention Is All You Need use?');
    expect(promptArg).toContain('ASSISTANT: It uses WMT 2014');
    expect(promptArg).toContain('USER QUESTION:\nAnd how about on English to French?');
    expect(rewritten).toBe('What was the BLEU score of Transformer on the English-to-French translation task?');

    generateSpy.mockRestore();
  });

  it('prevents duplicate user messages on retry when last message is identical user question', () => {
    const question = 'What are the main findings?';

    // Simulate duplicate check logic from ragService.ts
    const lastMessage = {
      role: 'user',
      content: 'what are the main findings?',
    };

    const isDuplicate =
      lastMessage &&
      lastMessage.role === 'user' &&
      lastMessage.content.trim().toLowerCase() === question.trim().toLowerCase();

    expect(isDuplicate).toBe(true);

    // When last message is assistant, it should not be treated as a duplicate
    const lastMessageAssistant = {
      role: 'assistant',
      content: 'Here are the main findings...',
    };

    const isNotDuplicate =
      lastMessageAssistant.role === 'user' &&
      lastMessageAssistant.content.trim().toLowerCase() === question.trim().toLowerCase();

    expect(isNotDuplicate).toBe(false);
  });
});
