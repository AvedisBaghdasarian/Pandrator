import { describe, it, expect } from 'vitest';
import {
  generateCueSheet,
  generateM3uPlaylist,
  generateChapterMetadataJson,
  generateWebVttSubtitles
} from './audiobook-exporter';

describe('Audiobook Exporter Utilities', () => {
  it('generates valid CUE sheet string', () => {
    const cue = generateCueSheet('Test Book', 'Test Author', [
      { title: 'Chapter 1', duration: 120.5 },
      { title: 'Chapter 2', duration: 180.0 }
    ]);

    expect(cue).toContain('TITLE "Test Book"');
    expect(cue).toContain('PERFORMER "Test Author"');
    expect(cue).toContain('TRACK 01 AUDIO');
    expect(cue).toContain('TITLE "Chapter 1"');
    expect(cue).toContain('TRACK 02 AUDIO');
  });

  it('generates valid M3U playlist', () => {
    const m3u = generateM3uPlaylist([
      { filename: '01_Chapter1.wav', title: 'Chapter 1', duration: 120 },
      { filename: '02_Chapter2.wav', title: 'Chapter 2', duration: 180 }
    ]);

    expect(m3u).toContain('#EXTM3U');
    expect(m3u).toContain('#EXTINF:120,Chapter 1');
    expect(m3u).toContain('01_Chapter1.wav');
  });

  it('generates valid JSON chapter metadata', () => {
    const jsonStr = generateChapterMetadataJson('Test Book', 'Test Author', [
      { title: 'Chapter 1', startTime: 0, duration: 120 }
    ]);

    const parsed = JSON.parse(jsonStr);
    expect(parsed.title).toBe('Test Book');
    expect(parsed.chapters.length).toBe(1);
    expect(parsed.chapters[0].title).toBe('Chapter 1');
  });

  it('generates valid WebVTT subtitles', () => {
    const vtt = generateWebVttSubtitles([
      { text: 'Hello world', startTime: 0, endTime: 2.5 }
    ]);

    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.500');
    expect(vtt).toContain('Hello world');
  });
});
