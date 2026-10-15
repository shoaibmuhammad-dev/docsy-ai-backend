import type { PageText } from "./pdf.service.js";

// Sizes are in characters (roughly 4 characters per token in English):
// 3000 chars is about 750 tokens, 400 chars of overlap is about 100 tokens.
const CHUNK_SIZE = 3000;
const CHUNK_OVERLAP = 400;
const MIN_CHUNK_LENGTH = 50; // drop tiny fragments such as page numbers

export interface TextChunk {
  chunkIndex: number;
  page: number; // page where the chunk starts, used for citations
  text: string;
}

const normalize = (text: string): string =>
  text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// Prefer to cut at a paragraph, then a line, then a sentence, then a word
const findBreak = (text: string, start: number, end: number): number => {
  const minPosition = start + Math.floor(CHUNK_SIZE * 0.6);

  for (const separator of ["\n\n", "\n", ". ", " "]) {
    const index = text.lastIndexOf(separator, end);
    if (index >= minPosition) {
      return index + separator.length;
    }
  }

  return end;
};

export const chunkPages = (pages: PageText[]): TextChunk[] => {
  // Join all pages into one text and remember where each page starts, so
  // chunks can cross page boundaries instead of being cut at every page end.
  let fullText = "";
  const pageStarts: { offset: number; page: number }[] = [];

  for (const { page, text } of pages) {
    const clean = normalize(text);
    if (!clean) continue;

    pageStarts.push({ offset: fullText.length, page });
    fullText += `${clean}\n\n`;
  }

  const pageAt = (position: number): number => {
    let found = pageStarts[0]?.page ?? 1;
    for (const entry of pageStarts) {
      if (entry.offset > position) break;
      found = entry.page;
    }
    return found;
  };

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < fullText.length) {
    let end = Math.min(start + CHUNK_SIZE, fullText.length);
    if (end < fullText.length) {
      end = findBreak(fullText, start, end);
    }

    const raw = fullText.slice(start, end);
    const text = raw.trim();

    if (text.length >= MIN_CHUNK_LENGTH) {
      const leadingWhitespace = raw.length - raw.trimStart().length;
      chunks.push({
        chunkIndex: chunks.length,
        page: pageAt(start + leadingWhitespace),
        text,
      });
    }

    if (end >= fullText.length) break;

    // Step back by the overlap, then move forward to the next word boundary
    let next = end - CHUNK_OVERLAP;
    const boundary = fullText.slice(next, end).search(/\s/);
    if (boundary !== -1) next += boundary + 1;

    start = Math.max(next, start + 1);
  }

  return chunks;
};
