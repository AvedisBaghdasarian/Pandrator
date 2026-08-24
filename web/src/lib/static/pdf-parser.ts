import * as pdfjs from 'pdfjs-dist';
import type { StaticChapter } from './text-cleaner';
import { buildChapterFromText, cleanEbookText } from './text-cleaner';

// Ensure worker source is set up for browser environments
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
}

export interface PdfParseResult {
  title: string;
  chapters: StaticChapter[];
  totalPages: number;
}

export async function parsePdfFile(file: File | ArrayBuffer): Promise<PdfParseResult> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const fileName = file instanceof File ? file.name : 'Document.pdf';
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const totalPages = pdfDoc.numPages;
  const pageTexts: { pageNum: number; text: string }[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageString = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push({ pageNum: i, text: pageString });
  }

  // Detect chapters by page ranges or logical splits if large document
  const chapters: StaticChapter[] = [];

  if (totalPages <= 5) {
    const fullText = pageTexts.map((p) => p.text).join('\n\n');
    chapters.push(buildChapterFromText(fileName.replace(/\.pdf$/i, ''), fullText, 0));
  } else {
    // Group pages into chapters (~5 pages per chapter chunk or page splits)
    const chunkSize = Math.max(1, Math.min(10, Math.ceil(totalPages / 5)));
    for (let c = 0; c < totalPages; c += chunkSize) {
      const slice = pageTexts.slice(c, c + chunkSize);
      const startPage = slice[0].pageNum;
      const endPage = slice[slice.length - 1].pageNum;
      const title = `Pages ${startPage}-${endPage}`;
      const text = slice.map((s) => s.text).join('\n\n');
      chapters.push(buildChapterFromText(title, text, chapters.length));
    }
  }

  return {
    title: fileName.replace(/\.pdf$/i, ''),
    chapters,
    totalPages
  };
}
