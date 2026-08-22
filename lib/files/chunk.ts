/**
 * Splits text into overlapping word-based chunks so each chunk fits
 * comfortably in an embedding call and retrieved context stays coherent
 * even when a relevant passage sits near a chunk boundary.
 */
export function chunkText(text: string, chunkSizeWords = 220, overlapWords = 40): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSizeWords, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) break;
    start = end - overlapWords;
  }

  return chunks;
}
