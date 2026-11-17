import { ExtractedPage, WordBlock } from './extractor.js';
import { config } from '../../config/env.js';

export interface TextChunk {
  chunkIndex: number;
  text: string;
  embeddingText?: string;
  section?: string;
  heading?: string;
  paragraphNumber?: number;
  paragraphStart?: number;
  paragraphEnd?: number;
  fileType?: string;
  pageNumber?: number; // Equal to pageStart for backward compatibility (PDFs)
  pageStart?: number;
  pageEnd?: number;
  tokenCount: number;
}

export interface ChunkerOptions {
  targetTokens?: number;
  overlapTokens?: number;
  tokenCounter?: (text: string) => number;
  docTitle?: string;
  stripReferences?: boolean;
}

interface PageMapEntry {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
}

interface SentenceItem {
  text: string;
  startOffset: number;
  endOffset: number;
  tokenCount: number;
  section?: string;
}

const SECTION_PATTERNS: { regex: RegExp; section: string }[] = [
  { regex: /^(?:(?:\d+(?:\.\d+)*\.?\s*)?abstract)\b/i, section: 'Abstract' },
  { regex: /^(?:(?:\d+(?:\.\d+)*\.?\s*)?introduction)\b/i, section: 'Introduction' },
  { regex: /^(?:(?:\d+(?:\.\d+)*\.?\s*)?(?:background|related\s+work))\b/i, section: 'Background' },
  { regex: /^(?:(?:section\s+\d+[:\s]+)?(?:\d+(?:\.\d+)*\.?\s*)?(?:methodology|methods|method|model\s+architecture|architecture|model|problem\s+formulation|pre-training\s+objectives|residual\s+mapping|algorithm))\b/i, section: 'Methodology' },
  { regex: /^(?:(?:section\s+\d+[:\s]+)?(?:\d+(?:\.\d+)*\.?\s*)?(?:experimental\s+setup|experiments|evaluation|training|benchmarks?|empirical\s+benchmarks|imagenet\s+benchmarks))\b/i, section: 'Experiments' },
  { regex: /^(?:(?:\d+(?:\.\d+)*\.?\s*)?results)\b/i, section: 'Results' },
  { regex: /^(?:(?:\d+(?:\.\d+)*\.?\s*)?discussion)\b/i, section: 'Discussion' },
  { regex: /^(?:(?:section\s+\d+[:\s]+)?(?:\d+(?:\.\d+)*\.?\s*)?(?:conclusion|conclusions|future\s+work|limitations|reported\s+limitations))\b/i, section: 'Conclusion' },
  { regex: /^(?:(?:\d+(?:\.\d+)*\.?\s*)?(?:references|bibliography))\b/i, section: 'References' },
  { regex: /^(?:(?:\d+(?:\.\d+)*\.?\s*)?appendix)\b/i, section: 'Appendix' },
];

/**
 * Detects common academic and technical section headings from a sentence or heading text.
 */
export function detectSectionHeading(text: string): string | null {
  const trimmed = text.trim();
  const firstLine = trimmed.split('\n')[0].trim();

  for (const p of SECTION_PATTERNS) {
    if (p.regex.test(trimmed) || p.regex.test(firstLine)) {
      return p.section;
    }
  }
  return null;
}

/**
 * Fast token count estimation (fallback for API providers or before tokenizer is loaded).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  return Math.max(1, Math.round((words * 1.33 + chars / 4) / 2));
}

/**
 * Splits text into sentences using standard Intl.Segmenter without corrupting numbers or abbreviations.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  const seg = new Intl.Segmenter('en', { granularity: 'sentence' });
  return [...seg.segment(text)].map((s) => s.segment.trim()).filter(Boolean);
}

/**
 * Resolves pageStart and pageEnd from character offsets using the document page map.
 */
function resolvePageSpan(
  startOffset: number,
  endOffset: number,
  pageMap: PageMapEntry[]
): { pageStart: number; pageEnd: number } {
  if (pageMap.length === 0) return { pageStart: 1, pageEnd: 1 };

  let pageStart = pageMap[0].pageNumber;
  let pageEnd = pageMap[pageMap.length - 1].pageNumber;

  for (const entry of pageMap) {
    if (startOffset >= entry.startOffset && startOffset <= entry.endOffset) {
      pageStart = entry.pageNumber;
    }
    if (endOffset >= entry.startOffset) {
      pageEnd = entry.pageNumber;
    }
  }

  if (pageStart > pageEnd) {
    pageEnd = pageStart;
  }

  return { pageStart, pageEnd };
}

/**
 * Hard-splits an oversized single sentence that exceeds targetTokens.
 */
function hardSplitSentence(
  text: string,
  startOffset: number,
  maxTokens: number,
  tokenCounter: (t: string) => number,
  section?: string
): SentenceItem[] {
  const words = text.split(/\s+/).filter(Boolean);
  const items: SentenceItem[] = [];
  let currentWords: string[] = [];
  let sliceStart = startOffset;

  for (let i = 0; i < words.length; i++) {
    currentWords.push(words[i]);
    const candidateText = currentWords.join(' ');
    const count = tokenCounter(candidateText);

    if (count >= maxTokens && currentWords.length > 1) {
      currentWords.pop();
      const sliceText = currentWords.join(' ');
      items.push({
        text: sliceText,
        startOffset: sliceStart,
        endOffset: sliceStart + sliceText.length,
        tokenCount: tokenCounter(sliceText),
        section,
      });
      sliceStart += sliceText.length + 1;
      currentWords = [words[i]];
    }
  }

  if (currentWords.length > 0) {
    const sliceText = currentWords.join(' ');
    items.push({
      text: sliceText,
      startOffset: sliceStart,
      endOffset: sliceStart + sliceText.length,
      tokenCount: tokenCounter(sliceText),
      section,
    });
  }

  return items;
}

/**
 * Builds formatted embedding text with document title and section context.
 */
function buildEmbeddingText(chunkText: string, section?: string, docTitle?: string): string {
  const sec = section || 'Content';
  const prefix = docTitle ? `${docTitle} | ${sec}: ` : `${sec}: `;
  return `${prefix}${chunkText}`;
}

/**
 * Chunks a document cross-page across page boundaries by sentences with overlap,
 * attaches section headings, and produces embeddingText with document context.
 * Strips bibliography/references sections by default to prevent vector space contamination.
 */
export function chunkPages(
  pages: ExtractedPage[],
  options: ChunkerOptions = {}
): TextChunk[] {
  const targetTokens = options.targetTokens ?? config.chunkTargetTokens ?? 220;
  const overlapTokens = options.overlapTokens ?? config.chunkOverlapTokens ?? 40;
  const tokenCounter = options.tokenCounter ?? estimateTokenCount;
  const docTitle = options.docTitle?.trim();
  const stripReferences = options.stripReferences ?? false;

  // 1. Build a single text stream for the whole document with char-offset -> page map
  const pageMap: PageMapEntry[] = [];
  let fullText = '';

  for (const page of pages) {
    if (!page.text || !page.text.trim()) continue;

    if (fullText.length > 0 && !fullText.endsWith('\n')) {
      fullText += '\n\n';
    }

    const startOffset = fullText.length;
    fullText += page.text.trim();
    const endOffset = fullText.length;

    pageMap.push({
      pageNumber: page.pageNumber,
      startOffset,
      endOffset,
    });
  }

  if (!fullText.trim()) return [];

  // 2. Extract sentences using Intl.Segmenter with exact offsets and detect sections
  const seg = new Intl.Segmenter('en', { granularity: 'sentence' });
  const rawSegments = [...seg.segment(fullText)];
  const sentenceItems: SentenceItem[] = [];
  let currentSection = 'Abstract'; // Initial section for page 1 before headings

  for (const item of rawSegments) {
    const text = item.segment.trim();
    if (!text) continue;

    const detected = detectSectionHeading(text);
    if (detected) {
      currentSection = detected;
    }

    // Strip references section from embedding chunks if configured
    if (stripReferences && currentSection === 'References') {
      continue;
    }

    const tokens = tokenCounter(text);
    if (tokens > targetTokens) {
      const splitItems = hardSplitSentence(text, item.index, targetTokens, tokenCounter, currentSection);
      sentenceItems.push(...splitItems);
    } else {
      sentenceItems.push({
        text,
        startOffset: item.index,
        endOffset: item.index + text.length,
        tokenCount: tokens,
        section: currentSection,
      });
    }
  }

  // Fallback: If stripping references left zero sentences (rare edge case), re-include
  if (sentenceItems.length === 0 && rawSegments.length > 0) {
    for (const item of rawSegments) {
      const text = item.segment.trim();
      if (!text) continue;
      const tokens = tokenCounter(text);
      sentenceItems.push({
        text,
        startOffset: item.index,
        endOffset: item.index + text.length,
        tokenCount: tokens,
        section: 'Content',
      });
    }
  }

  if (sentenceItems.length === 0) return [];

  // 3. Assemble cross-page chunks with overlap respecting section boundaries
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;
  let currentItems: SentenceItem[] = [];
  let currentTokens = 0;

  for (let i = 0; i < sentenceItems.length; i++) {
    const sentence = sentenceItems[i];
    const currentChunkSection = currentItems[0]?.section || sentence.section || 'Content';
    const isNewSection = currentItems.length > 0 && sentence.section && sentence.section !== currentChunkSection;

    if ((currentTokens + sentence.tokenCount > targetTokens || isNewSection) && currentItems.length > 0) {
      // Form chunk
      const chunkText = currentItems.map((s) => s.text).join(' ');
      const startOffset = currentItems[0].startOffset;
      const endOffset = currentItems[currentItems.length - 1].endOffset;
      const { pageStart, pageEnd } = resolvePageSpan(startOffset, endOffset, pageMap);
      const section = currentChunkSection;

      chunks.push({
        chunkIndex: chunkIndex++,
        text: chunkText,
        embeddingText: buildEmbeddingText(chunkText, section, docTitle),
        section,
        pageNumber: pageStart,
        pageStart,
        pageEnd,
        tokenCount: currentTokens,
      });

      // Compute overlap sentences (only within the same section)
      let overlapAccum = 0;
      const overlapItems: SentenceItem[] = [];
      if (!isNewSection) {
        for (let j = currentItems.length - 1; j >= 0; j--) {
          const prev = currentItems[j];
          if (overlapAccum + prev.tokenCount <= overlapTokens) {
            overlapItems.unshift(prev);
            overlapAccum += prev.tokenCount;
          } else {
            break;
          }
        }
      }

      currentItems = [...overlapItems, sentence];
      currentTokens = overlapAccum + sentence.tokenCount;
    } else {
      currentItems.push(sentence);
      currentTokens += sentence.tokenCount;
    }
  }

  // 4. Handle trailing sentences: merge tiny tail chunk (<~40 tokens) into previous chunk ONLY IF same section
  if (currentItems.length > 0) {
    const trailingSection = currentItems[0].section || 'Content';
    if (chunks.length > 0 && currentTokens < 40 && chunks[chunks.length - 1].section === trailingSection) {
      const lastChunk = chunks[chunks.length - 1];
      const tailText = currentItems.map((s) => s.text).join(' ');
      lastChunk.text = lastChunk.text + ' ' + tailText;
      lastChunk.embeddingText = buildEmbeddingText(lastChunk.text, lastChunk.section, docTitle);
      lastChunk.tokenCount += currentTokens;
      const tailEndOffset = currentItems[currentItems.length - 1].endOffset;
      const { pageEnd } = resolvePageSpan(currentItems[0].startOffset, tailEndOffset, pageMap);
      lastChunk.pageEnd = Math.max(lastChunk.pageEnd || pageEnd, pageEnd);
    } else {
      const chunkText = currentItems.map((s) => s.text).join(' ');
      const startOffset = currentItems[0].startOffset;
      const endOffset = currentItems[currentItems.length - 1].endOffset;
      const { pageStart, pageEnd } = resolvePageSpan(startOffset, endOffset, pageMap);
      const section = trailingSection;

      chunks.push({
        chunkIndex: chunkIndex++,
        text: chunkText,
        embeddingText: buildEmbeddingText(chunkText, section, docTitle),
        section,
        pageNumber: pageStart,
        pageStart,
        pageEnd,
        tokenCount: currentTokens,
      });
    }
  }

  return chunks;
}

export interface WordChunkOptions extends ChunkerOptions {
  docTitle?: string;
  format?: 'docx' | 'doc';
}

/**
 * Chunks a Word document (DOCX/DOC) by headings, paragraphs, and tables.
 * Retains document name, heading, and paragraph number references.
 * Never invents page numbers for Word documents (pageNumber, pageStart, pageEnd are undefined).
 */
export function chunkWordDocument(
  blocks: WordBlock[],
  options: WordChunkOptions = {}
): TextChunk[] {
  const targetTokens = options.targetTokens ?? config.chunkTargetTokens ?? 220;
  const overlapTokens = options.overlapTokens ?? config.chunkOverlapTokens ?? 40;
  const tokenCounter = options.tokenCounter ?? estimateTokenCount;
  const docTitle = options.docTitle?.trim();
  const format = options.format || 'docx';

  if (!blocks || blocks.length === 0) return [];

  interface WordSentenceItem {
    text: string;
    heading: string;
    section: string;
    paragraphNumber: number;
    tokenCount: number;
  }

  const sentenceItems: WordSentenceItem[] = [];

  for (const block of blocks) {
    const heading = block.heading || 'Content';
    const section = detectSectionHeading(heading) || heading;
    const paragraphNumber = block.paragraphNumber || 1;

    // If block text includes table rows or is small, keep as a single item
    if (block.text.includes('|') || tokenCounter(block.text) <= 50) {
      sentenceItems.push({
        text: block.text,
        heading,
        section,
        paragraphNumber,
        tokenCount: tokenCounter(block.text),
      });
      continue;
    }

    const sentences = splitIntoSentences(block.text);
    if (sentences.length === 0) {
      sentenceItems.push({
        text: block.text,
        heading,
        section,
        paragraphNumber,
        tokenCount: tokenCounter(block.text),
      });
      continue;
    }

    for (const sent of sentences) {
      const tokens = tokenCounter(sent);
      if (tokens > targetTokens) {
        const hardSplit = hardSplitSentence(sent, 0, targetTokens, tokenCounter, section);
        for (const hs of hardSplit) {
          sentenceItems.push({
            text: hs.text,
            heading,
            section,
            paragraphNumber,
            tokenCount: hs.tokenCount,
          });
        }
      } else {
        sentenceItems.push({
          text: sent,
          heading,
          section,
          paragraphNumber,
          tokenCount: tokens,
        });
      }
    }
  }

  if (sentenceItems.length === 0) return [];

  const chunks: TextChunk[] = [];
  let chunkIndex = 0;
  let currentItems: WordSentenceItem[] = [];
  let currentTokens = 0;

  for (let i = 0; i < sentenceItems.length; i++) {
    const item = sentenceItems[i];
    const currentHeading = currentItems[0]?.heading || item.heading;
    const isNewHeading = currentItems.length > 0 && item.heading !== currentHeading && currentTokens >= 80;

    if ((currentTokens + item.tokenCount > targetTokens || isNewHeading) && currentItems.length > 0) {
      const chunkText = currentItems.map((s) => s.text).join(' ');
      const firstItem = currentItems[0];
      const lastItem = currentItems[currentItems.length - 1];
      const heading = firstItem.heading;
      const section = firstItem.section;

      chunks.push({
        chunkIndex: chunkIndex++,
        text: chunkText,
        embeddingText: buildEmbeddingText(chunkText, heading, docTitle),
        section,
        heading,
        paragraphNumber: firstItem.paragraphNumber,
        paragraphStart: firstItem.paragraphNumber,
        paragraphEnd: lastItem.paragraphNumber,
        fileType: format,
        tokenCount: currentTokens,
      });

      let overlapAccum = 0;
      const overlapItems: WordSentenceItem[] = [];
      if (!isNewHeading) {
        for (let j = currentItems.length - 1; j >= 0; j--) {
          const prev = currentItems[j];
          if (overlapAccum + prev.tokenCount <= overlapTokens) {
            overlapItems.unshift(prev);
            overlapAccum += prev.tokenCount;
          } else {
            break;
          }
        }
      }

      currentItems = [...overlapItems, item];
      currentTokens = overlapAccum + item.tokenCount;
    } else {
      currentItems.push(item);
      currentTokens += item.tokenCount;
    }
  }

  if (currentItems.length > 0) {
    const firstItem = currentItems[0];
    const lastItem = currentItems[currentItems.length - 1];
    const heading = firstItem.heading;
    const section = firstItem.section;

    if (chunks.length > 0 && currentTokens < 40 && chunks[chunks.length - 1].heading === heading) {
      const lastChunk = chunks[chunks.length - 1];
      const tailText = currentItems.map((s) => s.text).join(' ');
      lastChunk.text = lastChunk.text + ' ' + tailText;
      lastChunk.embeddingText = buildEmbeddingText(lastChunk.text, lastChunk.heading || lastChunk.section, docTitle);
      lastChunk.tokenCount += currentTokens;
      lastChunk.paragraphEnd = lastItem.paragraphNumber;
    } else {
      const chunkText = currentItems.map((s) => s.text).join(' ');
      chunks.push({
        chunkIndex: chunkIndex++,
        text: chunkText,
        embeddingText: buildEmbeddingText(chunkText, heading, docTitle),
        section,
        heading,
        paragraphNumber: firstItem.paragraphNumber,
        paragraphStart: firstItem.paragraphNumber,
        paragraphEnd: lastItem.paragraphNumber,
        fileType: format,
        tokenCount: currentTokens,
      });
    }
  }

  return chunks;
}
