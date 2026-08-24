export interface StaticChapter {
  id: string;
  title: string;
  content: string;
  segments: string[];
  wordCount: number;
}

export function cleanEbookText(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Normalize line breaks
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Dehyphenate words broken across lines: e.g. "com- \n plete" or "in-\nformation" -> "information"
  cleaned = cleaned.replace(/([a-zA-Z\u00C0-\u024F])-\n\s*([a-zA-Z\u00C0-\u024F])/g, '$1$2');

  // Remove page numbers and headers/footers like "Page 12" or "12 / 345"
  cleaned = cleaned.replace(/\n\s*(?:Page|Pg\.?)\s*\d+\s*(?:of\s*\d+)?\s*\n/gi, '\n');
  cleaned = cleaned.replace(/\n\s*\d+\s*\/\s*\d+\s*\n/g, '\n');
  cleaned = cleaned.replace(/\n\s*\d+\s*\n/g, '\n');

  // Replace multiple newlines with paragraph separation
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Replace consecutive spaces and tabs with a single space
  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  // Normalize smart quotes and dashes
  cleaned = cleaned
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, ' - ');

  return cleaned.trim();
}

export function segmentTextForSpeech(text: string): string[] {
  const cleaned = cleanEbookText(text);
  if (!cleaned) return [];

  // Split into paragraphs first
  const paragraphs = cleaned.split(/\n\s*\n/);
  const segments: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Split paragraphs into sentences using punctuation boundaries
    const sentences = trimmed.match(/[^.!?]+[.!?]+["'\u201D\u2019]?|\s*[^.!?]+$/g) || [trimmed];

    for (let sentence of sentences) {
      sentence = sentence.trim();
      if (!sentence) continue;

      // If sentence is exceptionally long (>250 chars), break at clause boundaries
      if (sentence.length > 250) {
        const clauses = sentence.split(/(?<=[,;:—])\s+/);
        let currentChunk = '';

        for (const clause of clauses) {
          if ((currentChunk + ' ' + clause).trim().length > 250 && currentChunk.length > 0) {
            segments.push(currentChunk.trim());
            currentChunk = clause;
          } else {
            currentChunk = currentChunk ? `${currentChunk} ${clause}` : clause;
          }
        }
        if (currentChunk.trim()) {
          segments.push(currentChunk.trim());
        }
      } else {
        segments.push(sentence);
      }
    }
  }

  return segments;
}

export function buildChapterFromText(title: string, rawText: string, index: number): StaticChapter {
  const content = cleanEbookText(rawText);
  const segments = segmentTextForSpeech(content);
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;

  return {
    id: `chapter-${index + 1}`,
    title: title || `Chapter ${index + 1}`,
    content,
    segments,
    wordCount
  };
}

export function autoDetectChapters(text: string): StaticChapter[] {
  const cleaned = cleanEbookText(text);
  if (!cleaned) return [];

  // Match common chapter headings: e.g. "Chapter 1", "CHAPTER II", "1. Introduction", "# Chapter Title"
  const chapterPattern = /(?:\n|^)(?=(?:#+\s+|CHAPTER\s+\d+|CHAPTER\s+[IVXLCDM]+|\d+\.\s+[A-Z]))/i;
  const parts = cleaned.split(chapterPattern).map((p) => p.trim()).filter(Boolean);

  if (parts.length <= 1) {
    return [buildChapterFromText('Chapter 1', cleaned, 0)];
  }

  return parts.map((part, idx) => {
    const lines = part.split('\n');
    const title = lines[0].replace(/^#+\s*/, '').trim() || `Chapter ${idx + 1}`;
    const body = lines.slice(1).join('\n').trim() || part;
    return buildChapterFromText(title, body, idx);
  });
}
