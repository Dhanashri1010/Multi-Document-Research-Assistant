import fs from 'fs';
import pdfParse from 'pdf-parse';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface Page1Metadata {
  title?: string;
  authors?: string[];
  year?: number;
  abstract?: string;
}

export interface ExtractionResult {
  totalPages: number;
  pages: ExtractedPage[];
  fullText: string;
  metadata?: Page1Metadata;
  warning?: string;
  isLowTextDensity?: boolean;
}

/**
 * Clean and normalize extracted text:
 * - Replaces non-printable control characters (except tabs and newlines)
 * - De-hyphenates line-break words ("trans-\nformer" -> "transformer")
 * - Strips standalone page numbers
 * - Normalizes excessive consecutive whitespace while preserving paragraph structure
 */
export function cleanText(rawText: string): string {
  if (!rawText) return '';
  let text = rawText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove control chars
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // De-hyphenate line-break words: "trans-\nformer" -> "transformer"
  text = text.replace(/([a-zA-Z]+)-\n([a-zA-Z]+)/g, '$1$2');

  // Strip standalone page numbers (lines containing only digits or "Page X")
  text = text
    .split('\n')
    .filter((line) => !/^\s*(?:page\s+)?\d+\s*$/i.test(line))
    .join('\n');

  // Fix split decimal numbers from PDF extraction: "3 . 3" -> "3.3", "0 . 999" -> "0.999"
  text = text.replace(/(\b\d+)\s*\.\s*(\d+\b)/g, '$1.$2');

  // Fix split math powers and scientific notation: "10 − 8" -> "10^-8", "10 - 3" -> "10^-3"
  text = text.replace(/\b10\s*[−-]\s*(\d+)\b/g, '10^-$1');
  text = text.replace(/([·•\*])\s*10\s+(\d+)/g, '$1 10^$2');

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

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Re-orders text items for academic two-column layouts.
 * Prevents horizontal interleaving of columns by reading Column 1 top-to-bottom,
 * then Column 2 top-to-bottom, while preserving full-width titles/abstracts at the top.
 */
function assemblePageTextFromItems(items: RawTextItem[]): string {
  if (items.length === 0) return '';

  // Determine horizontal page bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minY = Infinity;

  for (const it of items) {
    if (it.str.trim().length === 0) continue;
    if (it.x < minX) minX = it.x;
    if (it.x + it.width > maxX) maxX = it.x + it.width;
    if (it.y > maxY) maxY = it.y;
    if (it.y < minY) minY = it.y;
  }

  const pageWidth = maxX - minX;

  // If text width is small or items are sparse, sort normally top-down
  if (pageWidth < 250 || items.length < 15) {
    const sorted = [...items].sort((a, b) => {
      if (Math.abs(b.y - a.y) > 3) return b.y - a.y; // top to bottom
      return a.x - b.x; // left to right
    });
    return renderLineGroups(sorted);
  }

  const midX = minX + pageWidth / 2;
  const leftColThreshold = midX - 15;
  const rightColThreshold = midX + 15;

  let leftCount = 0;
  let rightCount = 0;
  let centerSpanningCount = 0;

  for (const it of items) {
    if (it.str.trim().length === 0) continue;
    if (it.x + it.width <= leftColThreshold) {
      leftCount++;
    } else if (it.x >= rightColThreshold) {
      rightCount++;
    } else {
      centerSpanningCount++;
    }
  }

  // Detect two-column layout: significant items in both columns and clear gutter
  const isTwoColumn = leftCount >= 8 && rightCount >= 8 && (leftCount + rightCount) > centerSpanningCount * 1.5;

  if (!isTwoColumn) {
    const sorted = [...items].sort((a, b) => {
      if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
      return a.x - b.x;
    });
    return renderLineGroups(sorted);
  }

  // In two-column layout:
  // Identify where the two columns begin vertically (top banner cutoff)
  let colTopY = -Infinity;
  for (const it of items) {
    if (it.str.trim().length === 0) continue;
    if (it.x >= rightColThreshold && it.y > colTopY) {
      colTopY = it.y;
    }
  }

  // Any items above colTopY + 5 are top banner (title, authors, abstract)
  const topBanner: RawTextItem[] = [];
  const leftColumn: RawTextItem[] = [];
  const rightColumn: RawTextItem[] = [];
  const bottomBanner: RawTextItem[] = [];

  for (const it of items) {
    if (it.str.trim().length === 0) continue;

    if (it.y > colTopY + 5) {
      topBanner.push(it);
    } else if (it.x + it.width <= midX + 5) {
      leftColumn.push(it);
    } else if (it.x >= midX - 5) {
      rightColumn.push(it);
    } else {
      // Center item below top banner: assign based on center of item
      const itemCenter = it.x + it.width / 2;
      if (itemCenter < midX) {
        leftColumn.push(it);
      } else {
        rightColumn.push(it);
      }
    }
  }

  const sortTopDown = (a: RawTextItem, b: RawTextItem) => {
    if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
    return a.x - b.x;
  };

  topBanner.sort(sortTopDown);
  leftColumn.sort(sortTopDown);
  rightColumn.sort(sortTopDown);
  bottomBanner.sort(sortTopDown);

  const parts = [
    renderLineGroups(topBanner),
    renderLineGroups(leftColumn),
    renderLineGroups(rightColumn),
    renderLineGroups(bottomBanner),
  ].filter(Boolean);

  return parts.join('\n\n');
}

/**
 * Groups sorted items with identical or close Y coordinates into continuous horizontal lines.
 */
function renderLineGroups(items: RawTextItem[]): string {
  if (items.length === 0) return '';

  let lines: string[] = [];
  let currentLineItems: RawTextItem[] = [];
  let currentY: number | null = null;

  for (const item of items) {
    if (currentY === null || Math.abs(currentY - item.y) <= 3) {
      currentLineItems.push(item);
      currentY = item.y;
    } else {
      // Flush current line
      currentLineItems.sort((a, b) => a.x - b.x);
      lines.push(currentLineItems.map((it) => it.str).join(' '));
      currentLineItems = [item];
      currentY = item.y;
    }
  }

  if (currentLineItems.length > 0) {
    currentLineItems.sort((a, b) => a.x - b.x);
    lines.push(currentLineItems.map((it) => it.str).join(' '));
  }

  return lines.join('\n');
}

/**
 * Extracts text from a PDF file while preserving individual page numbers,
 * handling academic two-column layouts, and detecting corrupt, encrypted, or scanned documents.
 */
export async function extractPdf(filePath: string): Promise<ExtractionResult> {
  // 1. Validate File Existence and Non-Zero Size
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at path: ${filePath}`);
  }

  const stats = await fs.promises.stat(filePath);
  if (stats.size === 0) {
    throw new Error('Corrupt PDF: The uploaded file is empty (0 bytes).');
  }

  // 2. Validate Magic Bytes (%PDF-)
  const headerBuf = Buffer.alloc(5);
  const fd = await fs.promises.open(filePath, 'r');
  await fd.read(headerBuf, 0, 5, 0);
  await fd.close();

  if (headerBuf.toString() !== '%PDF-') {
    throw new Error('Invalid PDF format: File header does not start with "%PDF-". The document is damaged or not a valid PDF.');
  }

  const dataBuffer = await fs.promises.readFile(filePath);
  const pages: ExtractedPage[] = [];

  // 3. Custom page renderer hook to extract text per page with two-column sorting
  const pageRenderHook = async (pageData: any): Promise<string> => {
    const textContent = await pageData.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });

    const rawItems: RawTextItem[] = [];
    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        rawItems.push({
          str: item.str,
          x: item.transform ? item.transform[4] : 0,
          y: item.transform ? item.transform[5] : 0,
          width: item.width || 0,
          height: item.height || 0,
        });
      }
    }

    const assembled = assemblePageTextFromItems(rawItems);
    const cleaned = cleanText(assembled);
    const pageIndex = pageData.pageIndex !== undefined ? pageData.pageIndex + 1 : pages.length + 1;

    pages.push({
      pageNumber: pageIndex,
      text: cleaned,
    });

    return cleaned;
  };

  // 4. Parse with pdf-parse and handle encryption/corruption errors
  let parsed: any;
  try {
    parsed = await (pdfParse as any)(dataBuffer, {
      pagerender: pageRenderHook,
    });
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('password') || msg.includes('encrypted')) {
      throw new Error('Encrypted PDF: The document is password-protected. Please upload an unencrypted version.');
    }
    throw new Error(`Corrupted PDF: Failed to parse PDF structure (${err.message}).`);
  }

  // Sort pages by pageNumber
  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  // If pageRenderHook didn't capture individual pages, fallback to parsed.text
  if (pages.length === 0 && parsed.text) {
    const cleaned = cleanText(parsed.text);
    pages.push({
      pageNumber: 1,
      text: cleaned,
    });
  }

  // 5. Remove repeated headers and footers across pages first
  const cleanedPages = removeRepeatedHeadersFooters(pages);

  // 6. Scanned / Image-Only Bitmap Detection
  // Check total non-header character volume and per-page text density
  const totalChars = cleanedPages.reduce((sum, p) => sum + p.text.replace(/\s+/g, '').length, 0);
  const totalPagesCount = parsed.numpages || cleanedPages.length || 1;
  const avgCharsPerPage = totalChars / totalPagesCount;

  // Truly image-only / empty PDFs: hard rejection
  if (totalChars < 50 || avgCharsPerPage < 20) {
    throw new Error(
      `Image-Only / Scanned Document: No machine-readable text found in the PDF (found only ${totalChars} characters across ${totalPagesCount} page(s)). OCR is required to extract content from this document.`
    );
  }

  // Borderline low text density (e.g. presentation slides with single-line titles): attach warning / OCR recommendation
  let warning: string | undefined;
  let isLowTextDensity = false;
  if (totalPagesCount >= 3 && avgCharsPerPage < 120) {
    isLowTextDensity = true;
    warning = `Low text density detected (averaging only ${Math.round(avgCharsPerPage)} characters per page across ${totalPagesCount} pages). The core content appears to be embedded inside slide images, diagrams, or screenshots. OCR is recommended for full textual fidelity.`;
  }

  const fullText = cleanedPages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');
  const metadata = extractPage1Metadata(cleanedPages[0]?.text || '');

  return {
    totalPages: totalPagesCount,
    pages: cleanedPages,
    fullText,
    metadata,
    warning,
    isLowTextDensity,
  };
}

/**
 * Extracts title, authors, year, and abstract from page 1 text.
 */
export interface Page1Metadata {
  title?: string;
  authors?: string[];
  affiliations?: string[];
  year?: number;
  abstract?: string;
  frontMatterText?: string;
}

/**
 * Extracts title, authors, year, and abstract from page 1 text.
 */
export function extractPage1Metadata(page1Text: string): Page1Metadata {
  if (!page1Text || !page1Text.trim()) return {};

  const rawLines = page1Text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) return {};

  // Filter out boilerplate permission notices at the very top
  const lines = rawLines.filter((l) => {
    return !/^(?:provided proper attribution|google hereby grants|reproduce the tables|journalistic or scholarly|proceedings of the|published as a conference|accepted as a conference|under review as a conference)/i.test(l);
  });

  if (lines.length === 0) return {};

  let title = '';
  let authors: string[] = [];
  let affiliations: string[] = [];
  let year: number | undefined;
  let abstract = '';

  // 1. Year Extraction
  // Look for arXiv tags (e.g. arXiv:2106.09685 -> 2021)
  const arxivMatch = page1Text.match(/arxiv:\s*(\d{2})\d{2}\./i);
  if (arxivMatch) {
    const parsedYear = 2000 + parseInt(arxivMatch[1], 10);
    if (parsedYear >= 1990 && parsedYear <= 2035) {
      year = parsedYear;
    }
  }

  // Look for 4-digit years near publication/conference terms or dates
  if (!year) {
    const yearMatch = page1Text.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      const parsedYear = parseInt(yearMatch[1], 10);
      if (parsedYear >= 1970 && parsedYear <= 2035) {
        year = parsedYear;
      }
    }
  }

  // 2. Abstract, Title, and Authors Extraction
  // Support spaced letters like "A B S T R A C T" or "A BSTRACT"
  const abstractLineIdx = lines.findIndex((l) =>
    /^(?:a\s*b\s*s\s*t\s*r\s*a\s*c\s*t[:\s-]*$|^a\s*b\s*s\s*t\s*r\s*a\s*c\s*t[:\s-]+)/i.test(l)
  );

  if (abstractLineIdx > 0) {
    // Title is typically line 0 (and optionally line 1 if short and not an author)
    title = lines[0];
    if (abstractLineIdx > 2 && lines[1].length < 120 && !lines[1].includes('@') && !/^(by|authors?:)/i.test(lines[1])) {
      if (!lines[1].includes(',') && !lines[1].toLowerCase().includes('university') && !lines[1].toLowerCase().includes('google') && !lines[1].toLowerCase().includes('microsoft')) {
        title = `${title} ${lines[1]}`;
      }
    }

    // Authors and affiliations are between title and abstract
    const headerLines = lines.slice(1, abstractLineIdx);
    const candidateAuthors: string[] = [];
    const candidateAffiliations: string[] = [];

    for (const line of headerLines) {
      if (line.includes('@') || /arxiv:|http|published|accepted|equal contribution/i.test(line)) continue;

      if (/google\s*brain|google\s*research|university\s*of|microsoft|openai|cornell|cmu|mit|stanford|berkeley|laboratory|institute|department/i.test(line)) {
        candidateAffiliations.push(line.replace(/[\d*†‡§()]+/g, '').trim());
        continue;
      }

      const parts = line.split(/,|(?:\band\b)|;/).map((p) => p.trim()).filter((p) => p.length >= 2 && p.length < 50);
      for (const p of parts) {
        const cleanedName = p.replace(/[\d*†‡§()]+/g, '').trim();
        if (cleanedName.length >= 2 && !/^(and|by|et al\.?|\*)$/i.test(cleanedName)) {
          candidateAuthors.push(cleanedName);
        }
      }
    }

    authors = Array.from(new Set(candidateAuthors)).slice(0, 15);
    affiliations = Array.from(new Set(candidateAffiliations)).slice(0, 10);

    // Abstract text
    const abstractLines: string[] = [];
    const firstAbsLine = lines[abstractLineIdx].replace(/^a\s*b\s*s\s*t\s*r\s*a\s*c\s*t[:\s-]*/i, '').trim();
    if (firstAbsLine) {
      abstractLines.push(firstAbsLine);
    }

    for (let i = abstractLineIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^(?:(?:\d+\.?\s*)?(?:i\s*n\s*t\s*r\s*o\s*d\s*u\s*c\s*t\s*i\s*o\s*n|background|overview)|index terms)/i.test(line)) {
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

  // Clean title formatting (e.g. "L O RA" -> "LoRA", "A DAM" -> "Adam")
  title = title
    .replace(/\bL\s+O\s+RA\b/gi, 'LoRA')
    .replace(/\bA\s+DAM\b/gi, 'Adam')
    .replace(/\s+/g, ' ')
    .trim();

  const frontMatterText = lines.slice(0, Math.min(abstractLineIdx > 0 ? abstractLineIdx + 10 : 15, lines.length)).join('\n');

  return {
    title: title || undefined,
    authors: authors.length > 0 ? authors : undefined,
    affiliations: affiliations.length > 0 ? affiliations : undefined,
    year,
    abstract: abstract || undefined,
    frontMatterText,
  };
}
