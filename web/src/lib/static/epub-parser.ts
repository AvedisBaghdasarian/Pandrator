import JSZip from 'jszip';
import type { StaticChapter } from './text-cleaner';
import { buildChapterFromText } from './text-cleaner';

export interface EpubParseResult {
  title: string;
  author: string;
  chapters: StaticChapter[];
}

export async function parseEpubFile(file: File | ArrayBuffer): Promise<EpubParseResult> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  let bookTitle = file instanceof File ? file.name.replace(/\.epub$/i, '') : 'eBook';
  let author = 'Unknown Author';

  // Try finding container.xml to resolve package document (.opf)
  const containerFile = loadedZip.file('META-INF/container.xml');
  let opfPath = '';

  if (containerFile) {
    const containerText = await containerFile.async('text');
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerText, 'text/xml');
    const rootfile = doc.querySelector('rootfile');
    if (rootfile) {
      opfPath = rootfile.getAttribute('full-path') || '';
    }
  }

  const htmlFiles: { path: string; title: string; content: string }[] = [];

  if (opfPath && loadedZip.file(opfPath)) {
    const opfText = await loadedZip.file(opfPath)!.async('text');
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfText, 'text/xml');

    const titleEl = opfDoc.querySelector('title, dc\\:title');
    if (titleEl?.textContent) bookTitle = titleEl.textContent.trim();

    const creatorEl = opfDoc.querySelector('creator, dc\\:creator');
    if (creatorEl?.textContent) author = creatorEl.textContent.trim();

    // Extract manifest items
    const manifestItems = new Map<string, { href: string; mediaType: string }>();
    opfDoc.querySelectorAll('manifest > item').forEach((item) => {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      const mediaType = item.getAttribute('media-type');
      if (id && href) manifestItems.set(id, { href, mediaType: mediaType || '' });
    });

    // Extract spine order
    const spineItemrefs = opfDoc.querySelectorAll('spine > itemref');
    const basePath = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    for (const itemref of Array.from(spineItemrefs)) {
      const idref = itemref.getAttribute('idref');
      if (idref && manifestItems.has(idref)) {
        const manifest = manifestItems.get(idref)!;
        const fullPath = basePath + manifest.href;
        const entry = loadedZip.file(fullPath) || loadedZip.file(manifest.href);
        if (entry) {
          const rawHtml = await entry.async('text');
          const parsed = parseHtmlContent(rawHtml);
          if (parsed.text.trim().length > 20) {
            htmlFiles.push({ path: fullPath, title: parsed.title, content: parsed.text });
          }
        }
      }
    }
  }

  // Fallback: If OPF parsing yielded no html files, iterate all xhtml/html entries
  if (htmlFiles.length === 0) {
    const entries = Object.keys(loadedZip.files).filter((path) =>
      /\.(xhtml|html|htm)$/i.test(path)
    );

    for (const path of entries) {
      const rawHtml = await loadedZip.files[path].async('text');
      const parsed = parseHtmlContent(rawHtml);
      if (parsed.text.trim().length > 20) {
        htmlFiles.push({ path, title: parsed.title, content: parsed.text });
      }
    }
  }

  const chapters: StaticChapter[] = htmlFiles.map((item, idx) =>
    buildChapterFromText(item.title || `Chapter ${idx + 1}`, item.content, idx)
  );

  return {
    title: bookTitle,
    author,
    chapters: chapters.length > 0 ? chapters : [buildChapterFromText('Book', '', 0)]
  };
}

function parseHtmlContent(rawHtml: string): { title: string; text: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // Remove script and style elements
  doc.querySelectorAll('script, style, noscript').forEach((el) => el.remove());

  const h1 = doc.querySelector('h1, h2, h3');
  const title = h1?.textContent?.trim() || doc.title || '';

  const bodyText = doc.body ? doc.body.textContent || '' : doc.textContent || '';
  return { title, text: bodyText };
}
