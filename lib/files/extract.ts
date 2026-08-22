import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ExtractionResult {
  text: string;
  /** False for file types we intentionally don't extract text from yet (e.g. images — see Phase 7). */
  supported: boolean;
}

export async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<ExtractionResult> {
  try {
    if (mimeType === 'application/pdf') {
      // Lazy import: pdf-parse touches the filesystem for its debug mode at
      // import time in some versions, so only load it when actually needed.
      const pdfParse = (await import('pdf-parse')).default;
      const result = await pdfParse(buffer);
      return { text: result.text, supported: true };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value, supported: true };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls')
    ) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const text = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        return `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`;
      }).join('\n\n');
      return { text, supported: true };
    }

    if (mimeType === 'text/csv' || fileName.endsWith('.csv')) {
      const raw = buffer.toString('utf-8');
      const parsed = Papa.parse<string[]>(raw, { skipEmptyLines: true });
      const text = parsed.data.map((row) => row.join(', ')).join('\n');
      return { text, supported: true };
    }

    if (mimeType.startsWith('text/') || fileName.endsWith('.md') || fileName.endsWith('.txt')) {
      return { text: buffer.toString('utf-8'), supported: true };
    }

    if (mimeType.startsWith('image/')) {
      // Images aren't chunked/embedded for RAG — they're handled by the
      // separate vision path (Phase 7 in the original spec), not this
      // text-extraction pipeline.
      return { text: '', supported: false };
    }

    return { text: '', supported: false };
  } catch (err) {
    throw new Error(
      `Could not extract text from "${fileName}": ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}
