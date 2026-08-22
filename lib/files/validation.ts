export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp'
]);

export function isAllowedFile(mimeType: string, fileName: string): boolean {
  if (ALLOWED_MIME_TYPES.has(mimeType)) return true;
  // Some browsers send an empty/generic mime type for .md files — fall back to extension.
  return /\.(pdf|docx|xlsx|xls|csv|txt|md|png|jpe?g|webp)$/i.test(fileName);
}
