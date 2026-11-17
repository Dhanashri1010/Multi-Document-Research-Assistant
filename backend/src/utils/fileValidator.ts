import fs from 'fs';
import path from 'path';

export type SupportedDocumentFormat = 'pdf' | 'docx' | 'doc' | 'txt';

// Legacy Microsoft Word .doc CFBF magic bytes: D0 CF 11 E0 A1 B1 1A E1
const DOC_MAGIC_BYTES = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/**
 * Validates that a file starts with the PDF magic bytes "%PDF-" (0x25 0x50 0x44 0x46 0x2D).
 */
export function validatePdfMagicBytes(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;

    const buffer = Buffer.alloc(5);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);

    const magic = buffer.toString('utf-8');
    return magic.startsWith('%PDF-');
  } catch (_err) {
    return false;
  }
}

/**
 * Validates a buffer directly for PDF magic bytes.
 */
export function validatePdfBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 5) return false;
  const magic = buffer.subarray(0, 5).toString('utf-8');
  return magic.startsWith('%PDF-');
}

/**
 * Validates a buffer for DOCX (Office OpenXML ZIP container starting with PK\x03\x04).
 */
export function validateDocxBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  const isZip =
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08);

  if (!isZip) return false;

  // Confirm Word package presence: contains 'word/' or '[Content_Types].xml'
  const probe = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('binary');
  const tailProbe =
    buffer.length > 4096
      ? buffer.subarray(buffer.length - 4096).toString('binary')
      : '';

  return (
    probe.includes('[Content_Types].xml') ||
    probe.includes('word/') ||
    tailProbe.includes('word/') ||
    tailProbe.includes('[Content_Types].xml')
  );
}

/**
 * Validates a buffer for legacy Microsoft Word 97-2003 .doc (OLE CFBF format).
 */
export function validateDocBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== DOC_MAGIC_BYTES[i]) return false;
  }
  return true;
}

/**
 * Detects the document format based on signature/magic bytes and optional filename.
 */
export function detectDocumentFormat(
  buffer: Buffer,
  originalName?: string
): SupportedDocumentFormat | null {
  if (!buffer || buffer.length === 0) return null;

  if (validatePdfBuffer(buffer)) {
    return 'pdf';
  }

  if (validateDocxBuffer(buffer)) {
    return 'docx';
  }

  if (validateDocBuffer(buffer)) {
    return 'doc';
  }

  if (originalName) {
    const ext = path.extname(originalName).toLowerCase();
    if (ext === '.txt') {
      return 'txt';
    }
  }

  return null;
}

/**
 * Validates an uploaded document's buffer against expected format signatures.
 */
export function validateDocumentBuffer(
  buffer: Buffer,
  originalName?: string
): { isValid: boolean; format?: SupportedDocumentFormat; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: 'The uploaded file is empty (0 bytes).' };
  }

  const ext = originalName ? path.extname(originalName).toLowerCase() : '';

  // 1. PDF Validation
  if (ext === '.pdf') {
    if (!validatePdfBuffer(buffer)) {
      return {
        isValid: false,
        error: 'Invalid PDF format: File header does not start with "%PDF-". The document is corrupted or not a valid PDF.',
      };
    }
    return { isValid: true, format: 'pdf' };
  }

  // 2. DOCX Validation
  if (ext === '.docx') {
    if (!validateDocxBuffer(buffer)) {
      return {
        isValid: false,
        error: 'Invalid DOCX format: File does not match Microsoft Word (.docx) OpenXML package structure. The file may be corrupted or damaged.',
      };
    }
    return { isValid: true, format: 'docx' };
  }

  // 3. DOC Validation
  if (ext === '.doc') {
    if (!validateDocBuffer(buffer)) {
      return {
        isValid: false,
        error: 'Invalid DOC format: File header does not match Microsoft Word binary document (OLE CFBF) signature. Renaming a .docx or other file to .doc is not supported.',
      };
    }
    return { isValid: true, format: 'doc' };
  }

  // 4. TXT Validation
  if (ext === '.txt') {
    return { isValid: true, format: 'txt' };
  }

  // 5. Fallback: Detect by signature if no valid extension
  const detected = detectDocumentFormat(buffer, originalName);
  if (detected) {
    return { isValid: true, format: detected };
  }

  return {
    isValid: false,
    error: `Unsupported file format "${originalName || 'unknown'}". Only PDF (.pdf), Microsoft Word (.docx, .doc), and plain text (.txt) documents are supported.`,
  };
}

/**
 * Validates physical file magic bytes from disk for PDF, DOCX, DOC, and TXT.
 */
export async function validateDocumentMagicBytes(
  filePath: string,
  originalName?: string
): Promise<{ isValid: boolean; format?: SupportedDocumentFormat; error?: string }> {
  try {
    if (!fs.existsSync(filePath)) {
      return { isValid: false, error: `File not found at path: ${filePath}` };
    }

    const stats = await fs.promises.stat(filePath);
    if (stats.size === 0) {
      return { isValid: false, error: 'The uploaded file is empty (0 bytes).' };
    }

    const buffer = await fs.promises.readFile(filePath);
    return validateDocumentBuffer(buffer, originalName || path.basename(filePath));
  } catch (err: any) {
    return { isValid: false, error: `Unable to read document file: ${err.message}` };
  }
}

/**
 * Sanitizes an incoming original filename:
 * - Removes path traversal tokens (../, ..\)
 * - Strips characters forbidden on Windows/Linux (<>:"/\|?*\0)
 * - Collapses consecutive periods and spaces
 * - Caps maximum length at 200 characters
 * - Preserves document extension (.pdf, .docx, .doc, .txt)
 * - Ensures a fallback name if input is completely empty or stripped
 */
export function sanitizeFilename(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return `document_${Date.now()}.pdf`;
  }

  // Extract base filename without directories
  const base = path.basename(rawName.trim());
  const ext = path.extname(base).toLowerCase();
  const validExts = ['.pdf', '.docx', '.doc', '.txt'];
  const safeExt = validExts.includes(ext) ? ext : '.pdf';

  // Replace invalid characters with underscore
  let sanitized = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.{2,}/g, '.') // No multiple consecutive dots
    .replace(/\s+/g, ' ')    // Collapse multiple spaces
    .trim();

  // If filename ends up empty or starts with dot
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    sanitized = `document_${Date.now()}${safeExt}`;
  }

  // Cap length preserving extension
  if (sanitized.length > 200) {
    const currentExt = path.extname(sanitized);
    const stem = sanitized.slice(0, 200 - currentExt.length);
    sanitized = `${stem}${currentExt || safeExt}`;
  }

  return sanitized;
}
