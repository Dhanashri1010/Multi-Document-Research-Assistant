import fs from 'fs';
import pdfParse from 'pdf-parse';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface Page1Metadata {
  title?: string;
  authors?: string[];
  abstract?: string;
}

export interface ExtractionResult {
  totalPages: number;
  pages: ExtractedPage[];
  fullText: string;
  metadata?: Page1Metadata;
}

/**
 * Clean and normalize extracted text:
 * - Replaces non-printable control characters (except tabs and newlines)
 * - De-hyphenates line-break words ("trans-\nformer" -> "transformer")
 * - Strips standalone page numbers
 * - Normalizes excessive consecutive whitespace
 * - Preserves paragraph breaks and sentence structure
 */
export function cleanText(rawText: string): string {
  if (!rawText) return '';
  let text = rawText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove control chars
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // De-hyphenate line-break words: "trans-\nformer" -> "transformer"
  text = text.replace(/([a-zA-Z]+)-\n([a-zA-Z]+)/g, '$1$2');

  // Strip standalone page numbers (lines containing only digits)
  text = text
    .split('\n')
    .filter((line) => !/^\s*\d+\s*$/.test(line))
    .join('\n');

  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Removes repeated headers and footers that appear on more than 50% of the pages.
 */
export function removeRepeatedHeadersFooters(pages: ExtractedPage[]): ExtractedPage[] {
  if (pages.length <= 2) return pages;

  const lineCounts = new Map<string, number>();

  for (const page of pages) {
    const lines = page.text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length >= 4);

    const uniqueLinesOnPage = new Set(lines);
    for (const line of uniqueLinesOnPage) {
      lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
    }
  }

  const threshold = pages.length * 0.5;
  const repeatedLines = new Set<string>();

  for (const [line, count] of lineCounts.entries()) {
    if (count > threshold) {
      repeatedLines.add(line);
    }
  }

  if (repeatedLines.size === 0) return pages;

  return pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: page.text
      .split('\n')
      .filter((l) => !repeatedLines.has(l.trim()))
      .join('\n')
      .trim(),
  }));
}

/**
 * Extracts text from a plain-text (.txt) file into virtual pages of ~3000 characters.
 */
export async function extractTxt(filePath: string): Promise<ExtractionResult> {
  const data = await fs.promises.readFile(filePath, 'utf-8');
  const cleaned = cleanText(data);

  if (!cleaned.trim()) {
    return {
      totalPages: 0,
      pages: [],
      fullText: '',
    };
  }

  const pageSize = 3000;
  const pages: ExtractedPage[] = [];
  let offset = 0;
  let pageNumber = 1;

  while (offset < cleaned.length) {
    let end = Math.min(offset + pageSize, cleaned.length);
    if (end < cleaned.length) {
      // Prefer breaking at paragraph or line boundary
      const lastLineBreak = cleaned.lastIndexOf('\n', end);
      if (lastLineBreak > offset + pageSize * 0.7) {
        end = lastLineBreak + 1;
      }
    }

    const pageText = cleaned.slice(offset, end).trim();
    if (pageText) {
      pages.push({
        pageNumber: pageNumber++,
        text: pageText,
      });
    }
    offset = end;
  }

  const fullText = pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');
  const metadata = extractPage1Metadata(pages[0]?.text || '');

  return {
    totalPages: pages.length,
    pages,
    fullText,
    metadata,
  };
}

/**
 * Extracts text from a PDF file while preserving individual page numbers.
 */
export async function extractPdf(filePath: string): Promise<ExtractionResult> {
  const dataBuffer = await fs.promises.readFile(filePath);

  const pages: ExtractedPage[] = [];

  // Custom page renderer hook to extract text per page
  const pageRenderHook = async (pageData: any): Promise<string> => {
    const textContent = await pageData.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });

    let lastY: number | null = null;
    let pageText = '';

    for (const item of textContent.items) {
      if ('str' in item) {
        if (lastY === null || Math.abs(lastY - item.transform[5]) < 3) {
          pageText += (pageText.endsWith(' ') ? '' : ' ') + item.str;
        } else {
          pageText += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
    }

    const cleaned = cleanText(pageText);
    const pageIndex = pageData.pageIndex !== undefined ? pageData.pageIndex + 1 : pages.length + 1;

    pages.push({
      pageNumber: pageIndex,
      text: cleaned,
    });

    return cleaned;
  };

  const parsed = await (pdfParse as any)(dataBuffer, {
    pagerender: pageRenderHook,
  });

  // Sort pages by pageNumber in case callbacks returned out of order
  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  // If pageRenderHook didn't capture individual pages (e.g. single-page or alternate format), fallback
  if (pages.length === 0 && parsed.text) {
    const cleaned = cleanText(parsed.text);
    pages.push({
      pageNumber: 1,
      text: cleaned,
    });
  }

  // Remove repeated headers and footers across pages
  const cleanedPages = removeRepeatedHeadersFooters(pages);
  const fullText = cleanedPages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');
  const metadata = extractPage1Metadata(cleanedPages[0]?.text || '');

  return {
    totalPages: parsed.numpages || cleanedPages.length,
    pages: cleanedPages,
    fullText,
    metadata,
  };
}

/**
 * Extracts title, authors, and abstract from page 1 text.
 */
export function extractPage1Metadata(page1Text: string): Page1Metadata {
  if (!page1Text || !page1Text.trim()) return {};

  const lines = page1Text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return {};

  let title = '';
  let authors: string[] = [];
  let abstract = '';

  const abstractLineIdx = lines.findIndex((l) => /^(?:abstract[:\s-]*$|^abstract[:\s-]+)/i.test(l));

  if (abstractLineIdx > 0) {
    // Title is typically the first 1-2 lines before authors
    title = lines[0];
    if (abstractLineIdx > 2 && lines[1].length < 100 && !lines[1].includes('@') && !/^(by|authors?:)/i.test(lines[1])) {
      if (!lines[1].includes(',') && !lines[1].toLowerCase().includes('university')) {
        title = `${title} ${lines[1]}`;
      }
    }

    // Authors are between title and abstract
    const authorLines = lines.slice(1, abstractLineIdx).filter((l) => {
      if (l.includes('@') || /arxiv:|http|published|accepted/i.test(l)) return false;
      if (/department|university|laboratory|institute|google|research|corporation/i.test(l)) return false;
      return true;
    });

    const candidateAuthors: string[] = [];
    for (const line of authorLines) {
      const parts = line.split(/,|(?:\band\b)|;/).map((p) => p.trim()).filter((p) => p.length >= 2 && p.length < 50);
      for (const p of parts) {
        const cleanedName = p.replace(/[\d*†‡§]+/g, '').trim();
        if (cleanedName.length >= 2 && !/^(and|by|et al\.?)$/i.test(cleanedName)) {
          candidateAuthors.push(cleanedName);
        }
      }
    }
    authors = Array.from(new Set(candidateAuthors)).slice(0, 15);

    // Abstract text
    const abstractLines: string[] = [];
    const firstAbsLine = lines[abstractLineIdx].replace(/^abstract[:\s-]*/i, '').trim();
    if (firstAbsLine) {
      abstractLines.push(firstAbsLine);
    }

    for (let i = abstractLineIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^(?:(?:\d+\.?\s*)?(?:introduction|background|overview)|index terms)/i.test(line)) {
        break;
      }
      abstractLines.push(line);
    }
    abstract = abstractLines.join(' ').trim();
  } else {
    // Fallback: title is first line if reasonable length
    if (lines[0] && lines[0].length < 150) {
      title = lines[0];
    }
  }

  return {
    title: title || undefined,
    authors: authors.length > 0 ? authors : undefined,
    abstract: abstract || undefined,
  };
}
