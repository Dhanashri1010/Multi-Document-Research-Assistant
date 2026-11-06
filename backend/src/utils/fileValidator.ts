import fs from 'fs';
import path from 'path';

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
 * Sanitizes an incoming original filename:
 * - Removes path traversal tokens (../, ..\)
 * - Strips characters forbidden on Windows/Linux (<>:"/\|?*\0)
 * - Collapses consecutive periods and spaces
 * - Caps maximum length at 200 characters
 * - Ensures a fallback name if input is completely empty or stripped
 */
export function sanitizeFilename(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return `document_${Date.now()}.pdf`;
  }

  // Extract base filename without directories
  const base = path.basename(rawName.trim());

  // Replace invalid characters with underscore
  let sanitized = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.{2,}/g, '.') // No multiple consecutive dots
    .replace(/\s+/g, ' ')    // Collapse multiple spaces
    .trim();

  // If filename ends up empty or starts with dot
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    sanitized = `document_${Date.now()}.pdf`;
  }

  // Cap length preserving extension
  if (sanitized.length > 200) {
    const ext = path.extname(sanitized);
    const stem = sanitized.slice(0, 200 - ext.length);
    sanitized = `${stem}${ext}`;
  }

  return sanitized;
}
