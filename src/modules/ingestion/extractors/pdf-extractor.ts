import { PDFParse } from 'pdf-parse';
import { ExtractedDocument, TextExtractor } from './text-extractor.interface';

export class PdfExtractor implements TextExtractor {
  supports(mimeType: string, filename?: string): boolean {
    if (mimeType.toLowerCase() === 'application/pdf') {
      return true;
    }
    if (filename && filename.toLowerCase().endsWith('.pdf')) {
      return true;
    }
    return false;
  }

  async extract(buffer: Buffer, mimeType: string, filename?: string): Promise<ExtractedDocument> {
    const parser = new PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText();
      const text = textResult.text.trim();

      const sections =
        textResult.pages && textResult.pages.length > 0
          ? textResult.pages.map((p) => ({
              page: p.num,
              content: p.text.trim(),
            }))
          : [{ content: text }];

      return {
        text,
        sections,
        metadata: {
          pageCount: textResult.total,
          charCount: text.length,
          mimeType: 'application/pdf',
          title: filename,
        },
      };
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
}
