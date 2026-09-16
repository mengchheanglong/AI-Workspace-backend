import mammoth from 'mammoth';
import { ExtractedDocument, TextExtractor } from './text-extractor.interface';

export class DocxExtractor implements TextExtractor {
  private readonly supportedMimes = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ]);

  supports(mimeType: string, filename?: string): boolean {
    if (this.supportedMimes.has(mimeType.toLowerCase())) {
      return true;
    }
    if (
      filename &&
      (filename.toLowerCase().endsWith('.docx') || filename.toLowerCase().endsWith('.doc'))
    ) {
      return true;
    }
    return false;
  }

  async extract(buffer: Buffer, mimeType: string, filename?: string): Promise<ExtractedDocument> {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    // Split paragraphs by multiple newlines
    const paragraphs = text
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const sections = paragraphs.map((p) => ({
      content: p,
    }));

    return {
      text,
      sections: sections.length > 0 ? sections : [{ content: text }],
      metadata: {
        charCount: text.length,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        title: filename,
        messages: result.messages,
      },
    };
  }
}
