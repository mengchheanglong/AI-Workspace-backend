import { ExtractedDocument, DocumentSection } from '../extractors/text-extractor.interface';

export interface ChunkResult {
  chunkIndex: number;
  text: string;
  tokenCount: number;
  metadata: {
    sectionTitle?: string;
    page?: number;
    startChar?: number;
    endChar?: number;
    [key: string]: unknown;
  };
}

export interface ChunkerOptions {
  targetTokens?: number; // default ~600
  overlapTokens?: number; // default ~100
  approxCharsPerToken?: number; // default 4
}

export class SemanticChunker {
  private readonly targetTokens: number;
  private readonly overlapTokens: number;
  private readonly approxCharsPerToken: number;

  constructor(options?: ChunkerOptions) {
    this.targetTokens = options?.targetTokens ?? 600;
    this.overlapTokens = options?.overlapTokens ?? 100;
    this.approxCharsPerToken = options?.approxCharsPerToken ?? 4;
  }

  get targetChars(): number {
    return this.targetTokens * this.approxCharsPerToken; // ~2400 chars
  }

  get overlapChars(): number {
    return this.overlapTokens * this.approxCharsPerToken; // ~400 chars
  }

  chunk(doc: ExtractedDocument): ChunkResult[] {
    const results: ChunkResult[] = [];
    let chunkIndex = 0;

    // Process section by section to preserve structural boundaries
    const sections: DocumentSection[] =
      doc.sections && doc.sections.length > 0 ? doc.sections : [{ content: doc.text }];

    for (const section of sections) {
      const sectionContent = section.content.trim();
      if (!sectionContent) continue;

      if (sectionContent.length <= this.targetChars) {
        results.push({
          chunkIndex: chunkIndex++,
          text: sectionContent,
          tokenCount: this.estimateTokens(sectionContent),
          metadata: {
            sectionTitle: section.title,
            page: section.page,
            startChar: 0,
            endChar: sectionContent.length,
          },
        });
        continue;
      }

      // Split large section using natural paragraph / sentence breaks
      const subChunks = this.splitText(sectionContent);
      for (const sc of subChunks) {
        results.push({
          chunkIndex: chunkIndex++,
          text: sc.text,
          tokenCount: this.estimateTokens(sc.text),
          metadata: {
            sectionTitle: section.title,
            page: section.page,
            startChar: sc.startChar,
            endChar: sc.endChar,
          },
        });
      }
    }

    return results;
  }

  private splitText(text: string): { text: string; startChar: number; endChar: number }[] {
    const chunks: { text: string; startChar: number; endChar: number }[] = [];
    const maxChars = this.targetChars;
    const overlap = this.overlapChars;

    let start = 0;
    while (start < text.length) {
      const end = start + maxChars;

      if (end >= text.length) {
        const chunkText = text.substring(start).trim();
        if (chunkText.length > 0) {
          chunks.push({
            text: chunkText,
            startChar: start,
            endChar: text.length,
          });
        }
        break;
      }

      // Find natural boundary near end: paragraph -> sentence -> word
      let splitPoint = -1;

      // 1. Look for paragraph break between end - 300 and end
      const searchStart = Math.max(start + overlap, end - 300);
      const searchRegion = text.substring(searchStart, end + 100);
      const paraMatch = searchRegion.lastIndexOf('\n\n');
      if (paraMatch !== -1 && searchStart + paraMatch > start) {
        splitPoint = searchStart + paraMatch + 2;
      }

      // 2. Look for sentence break
      if (splitPoint === -1) {
        const sentenceMatches = [...searchRegion.matchAll(/[.!?]\s+/g)];
        if (sentenceMatches.length > 0) {
          const lastMatch = sentenceMatches[sentenceMatches.length - 1];
          if (lastMatch && lastMatch.index !== undefined) {
            splitPoint = searchStart + lastMatch.index + lastMatch[0].length;
          }
        }
      }

      // 3. Look for whitespace break
      if (splitPoint === -1) {
        const spaceMatch = searchRegion.lastIndexOf(' ');
        if (spaceMatch !== -1) {
          splitPoint = searchStart + spaceMatch + 1;
        }
      }

      // 4. Hard cut if no natural break found
      if (splitPoint === -1 || splitPoint <= start) {
        splitPoint = end;
      }

      const chunkText = text.substring(start, splitPoint).trim();
      if (chunkText.length > 0) {
        chunks.push({
          text: chunkText,
          startChar: start,
          endChar: splitPoint,
        });
      }

      // Advance with overlap
      const nextStart = splitPoint - overlap;
      start = nextStart > start ? nextStart : splitPoint;
    }

    return chunks;
  }

  estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / this.approxCharsPerToken));
  }
}
