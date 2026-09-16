import { SemanticChunker } from '../../src/modules/ingestion/chunker/semantic-chunker';
import { ExtractedDocument } from '../../src/modules/ingestion/extractors/text-extractor.interface';

describe('SemanticChunker', () => {
  let chunker: SemanticChunker;

  beforeEach(() => {
    chunker = new SemanticChunker({
      targetTokens: 100, // Small target for easy testing
      overlapTokens: 20,
      approxCharsPerToken: 4,
    });
  });

  it('should chunk small document into a single chunk with preserved locators', () => {
    const doc: ExtractedDocument = {
      text: 'Simple paragraph about requirements.',
      sections: [
        {
          title: 'Introduction',
          page: 1,
          content: 'Simple paragraph about requirements.',
        },
      ],
      metadata: {
        charCount: 36,
      },
    };

    const chunks = chunker.chunk(doc);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[0]!.text).toBe('Simple paragraph about requirements.');
    expect(chunks[0]!.metadata.sectionTitle).toBe('Introduction');
    expect(chunks[0]!.metadata.page).toBe(1);
    expect(chunks[0]!.tokenCount).toBeGreaterThan(0);
  });

  it('should preserve multiple sections as distinct chunks', () => {
    const doc: ExtractedDocument = {
      text: 'Overview\nDetails',
      sections: [
        {
          title: 'Section 1',
          page: 1,
          content: 'First section content.',
        },
        {
          title: 'Section 2',
          page: 2,
          content: 'Second section content.',
        },
      ],
      metadata: { charCount: 46 },
    };

    const chunks = chunker.chunk(doc);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.metadata.sectionTitle).toBe('Section 1');
    expect(chunks[0]!.metadata.page).toBe(1);
    expect(chunks[1]!.metadata.sectionTitle).toBe('Section 2');
    expect(chunks[1]!.metadata.page).toBe(2);
  });

  it('should split large text with overlap at natural boundaries', () => {
    // 100 tokens target * 4 = 400 chars target
    // Create text with several paragraphs ~600 chars
    const p1 = 'Paragraph 1 '.repeat(20); // ~240 chars
    const p2 = 'Paragraph 2 '.repeat(20); // ~240 chars
    const p3 = 'Paragraph 3 '.repeat(20); // ~240 chars
    const text = `${p1}\n\n${p2}\n\n${p3}`;

    const doc: ExtractedDocument = {
      text,
      sections: [{ content: text }],
      metadata: { charCount: text.length },
    };

    const chunks = chunker.chunk(doc);
    expect(chunks.length).toBeGreaterThan(1);
    // Consecutive chunks should maintain indexing order
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.chunkIndex).toBe(i);
      expect(chunks[i]!.text.length).toBeGreaterThan(0);
    }
  });

  it('should handle empty or whitespace-only documents', () => {
    const doc: ExtractedDocument = {
      text: '',
      sections: [],
      metadata: { charCount: 0 },
    };

    const chunks = chunker.chunk(doc);
    expect(chunks).toHaveLength(0);
  });
});
