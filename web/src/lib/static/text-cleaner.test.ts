import { describe, it, expect } from 'vitest';
import { cleanEbookText, segmentTextForSpeech, autoDetectChapters } from './text-cleaner';

describe('Text Cleaner & Parser Utility', () => {
  it('cleans hyphens broken across newlines', () => {
    const raw = 'This is an ex-\nample of dehyphenation.';
    const cleaned = cleanEbookText(raw);
    expect(cleaned).toBe('This is an example of dehyphenation.');
  });

  it('strips page numbers and headers', () => {
    const raw = 'Header text\n\nPage 12\n\nChapter body text here.';
    const cleaned = cleanEbookText(raw);
    expect(cleaned).not.toContain('Page 12');
    expect(cleaned).toContain('Chapter body text here.');
  });

  it('segments text into speech sentences properly', () => {
    const paragraph = 'Hello world! Welcome to Pandrator Static Studio. This is a third sentence.';
    const segments = segmentTextForSpeech(paragraph);
    expect(segments.length).toBe(3);
    expect(segments[0]).toBe('Hello world!');
    expect(segments[1]).toBe('Welcome to Pandrator Static Studio.');
  });

  it('auto-detects chapter headers', () => {
    const book = `
# Chapter 1: First Chapter
This is the content of chapter 1.

# Chapter 2: Second Chapter
This is the content of chapter 2.
    `.trim();

    const chapters = autoDetectChapters(book);
    expect(chapters.length).toBe(2);
    expect(chapters[0].title).toBe('Chapter 1: First Chapter');
    expect(chapters[1].title).toBe('Chapter 2: Second Chapter');
  });
});
