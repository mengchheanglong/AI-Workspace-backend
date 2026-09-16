import { ContextAssembler } from '../../src/modules/ai/context/context-assembler';
import { AiMode } from '../../src/modules/ai/entities/ai-mode.enum';
import { KnowledgeSourceType } from '../../src/modules/ingestion/entities';
import { RetrievedEvidence } from '../../src/modules/ai/retrieval/retrieval.service';

describe('ContextAssembler', () => {
  let assembler: ContextAssembler;

  beforeEach(() => {
    assembler = new ContextAssembler();
  });

  it('assembles system prompt with untrusted data boundary rules', () => {
    const evidence: RetrievedEvidence[] = [
      {
        chunkId: 'chunk-1',
        sourceId: 'req-1',
        sourceType: KnowledgeSourceType.REQUIREMENT,
        title: 'User Login System',
        revision: 1,
        locator: 'Section 3.1',
        snippet: 'System must require password of at least 8 characters.',
        score: 0.95,
      },
    ];

    const result = assembler.assemble('AI Workspace', AiMode.DEVELOPER, evidence);

    expect(result.systemPrompt).toContain('Developer mode');
    expect(result.systemPrompt).toContain('UNTRUSTED DATA BOUNDARY');
    expect(result.systemPrompt).toContain('insufficient evidence to answer this question');
    expect(result.evidenceItems).toHaveLength(1);
    expect(result.evidenceText).toContain('[Evidence #1]');
    expect(result.evidenceText).toContain('User Login System');
  });

  it('handles empty evidence honestly', () => {
    const result = assembler.assemble('AI Workspace', AiMode.PM, []);

    expect(result.evidenceItems).toHaveLength(0);
    expect(result.evidenceText).toContain('NO RELEVANT PROJECT EVIDENCE FOUND FOR THIS QUERY.');
    expect(result.systemPrompt).toContain('PM (Project Manager) mode');
  });

  it('respects token budgeting and trims excess evidence blocks', () => {
    // Generate many large evidence chunks
    const largeSnippet = 'A'.repeat(5000); // 5000 chars ~ 1250 tokens
    const evidence: RetrievedEvidence[] = Array.from({ length: 10 }, (_, i) => ({
      chunkId: `chunk-${i}`,
      sourceId: `source-${i}`,
      sourceType: KnowledgeSourceType.DOCUMENT,
      title: `Document ${i}`,
      revision: 1,
      locator: `Chunk #${i}`,
      snippet: largeSnippet,
      score: 0.9 - i * 0.05,
    }));

    const result = assembler.assemble('AI Workspace', AiMode.QA, evidence);

    // ContextAssembler caps at ~4000 tokens (16,000 characters). With 5000 chars each, only 3-4 chunks should fit.
    expect(result.evidenceItems.length).toBeLessThan(10);
    expect(result.evidenceItems.length).toBeGreaterThanOrEqual(1);
  });

  it('supports all 6 operational modes', () => {
    const modes = [
      AiMode.PM,
      AiMode.DEVELOPER,
      AiMode.QA,
      AiMode.DX,
      AiMode.INFRASTRUCTURE,
      AiMode.PRESENTATION,
    ];

    for (const mode of modes) {
      const result = assembler.assemble('Project X', mode, []);
      expect(result.systemPrompt.toLowerCase()).toContain(mode.toLowerCase());
    }
  });
});
