import { ExtractedDocument, TextExtractor } from './text-extractor.interface';

export class PlainTextExtractor implements TextExtractor {
  private readonly supportedMimes = new Set([
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
  ]);

  private readonly supportedExtensions = new Set(['.txt', '.md', '.markdown', '.json', '.csv']);

  supports(mimeType: string, filename?: string): boolean {
    if (this.supportedMimes.has(mimeType.toLowerCase())) {
      return true;
    }
    if (filename) {
      const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
      if (this.supportedExtensions.has(ext)) {
        return true;
      }
    }
    return false;
  }

  async extract(buffer: Buffer, mimeType: string, filename?: string): Promise<ExtractedDocument> {
    const text = buffer.toString('utf-8');
    const sections = this.extractSections(text);

    return {
      text,
      sections,
      metadata: {
        charCount: text.length,
        mimeType,
        title: filename,
      },
    };
  }

  private extractSections(text: string): { title?: string; content: string }[] {
    const lines = text.split(/\r?\n/);
    const sections: { title?: string; content: string }[] = [];
    let currentTitle: string | undefined = undefined;
    let currentLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
      if (headingMatch && headingMatch[1]) {
        if (currentLines.length > 0 || currentTitle) {
          sections.push({
            title: currentTitle,
            content: currentLines.join('\n').trim(),
          });
          currentLines = [];
        }
        currentTitle = headingMatch[1].trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0 || currentTitle) {
      const content = currentLines.join('\n').trim();
      if (content.length > 0 || currentTitle) {
        sections.push({
          title: currentTitle,
          content,
        });
      }
    }

    return sections.length > 0 ? sections : [{ content: text.trim() }];
  }
}
