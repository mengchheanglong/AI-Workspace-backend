export interface DocumentSection {
  title?: string;
  page?: number;
  content: string;
}

export interface ExtractedDocument {
  text: string;
  sections: DocumentSection[];
  metadata: {
    pageCount?: number;
    mimeType?: string;
    charCount: number;
    title?: string;
    [key: string]: unknown;
  };
}

export interface TextExtractor {
  supports(mimeType: string, filename?: string): boolean;
  extract(buffer: Buffer, mimeType: string, filename?: string): Promise<ExtractedDocument>;
}
