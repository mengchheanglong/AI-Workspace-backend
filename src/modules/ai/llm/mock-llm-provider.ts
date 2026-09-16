import { Injectable } from '@nestjs/common';
import { GenerateAnswerParams, GenerateAnswerResult, LlmProvider } from './llm-provider.interface';
import { CitationItem } from '../entities/chat-message.entity';

const STOP_WORDS = new Set([
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'whose',
  'why',
  'how',
  'the',
  'and',
  'for',
  'with',
  'about',
  'from',
  'into',
  'during',
  'including',
  'until',
  'against',
  'among',
  'throughout',
  'despite',
  'towards',
  'upon',
  'concerning',
  'to',
  'in',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'shall',
  'should',
  'can',
  'could',
  'may',
  'might',
  'must',
  'that',
  'this',
  'these',
  'those',
  'there',
  'their',
  'they',
  'you',
  'your',
  'our',
  'we',
  'any',
  'all',
  'some',
]);

@Injectable()
export class MockLlmProvider implements LlmProvider {
  async generateAnswer(params: GenerateAnswerParams): Promise<GenerateAnswerResult> {
    const { messages, evidence } = params;

    // Estimate prompt tokens
    const promptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const promptTokens = Math.max(1, Math.ceil(promptChars / 4));

    if (!evidence || evidence.length === 0) {
      const content =
        'Based on the current project knowledge, there is insufficient evidence to answer this question.';
      return {
        content,
        citations: [],
        modelName: 'mock-llm',
        promptTokens,
        completionTokens: Math.max(1, Math.ceil(content.length / 4)),
      };
    }

    // Check relevance: extract keywords from user query
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const queryKeywords = lastUserMessage
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    // Filter evidence to those relevant to query keywords
    const relevantEvidence =
      queryKeywords.length === 0
        ? evidence
        : evidence.filter((item) => {
            const target = `${item.title} ${item.locator || ''} ${item.snippet}`.toLowerCase();
            return queryKeywords.some((kw) => target.includes(kw));
          });

    if (relevantEvidence.length === 0) {
      const content =
        'Based on the current project knowledge, there is insufficient evidence to answer this question.';
      return {
        content,
        citations: [],
        modelName: 'mock-llm',
        promptTokens,
        completionTokens: Math.max(1, Math.ceil(content.length / 4)),
      };
    }

    const citations: CitationItem[] = [];
    const points: string[] = [];

    relevantEvidence.slice(0, 4).forEach((item, index) => {
      const evidenceNum = index + 1;
      const snippetClean = item.snippet.replace(/\s+/g, ' ').trim();
      const shortSnippet =
        snippetClean.length > 120 ? `${snippetClean.slice(0, 117)}...` : snippetClean;

      points.push(
        `- **${item.title}** (${item.locator}): ${shortSnippet} [Evidence #${evidenceNum}]`,
      );

      citations.push({
        chunkId: item.chunkId,
        sourceId: item.sourceId,
        sourceType: item.sourceType,
        title: item.title,
        revision: item.revision,
        locator: item.locator,
        score: item.score,
        snippet: item.snippet,
      });
    });

    const content = `Based on the project documentation, here is what has been determined:\n\n${points.join(
      '\n\n',
    )}\n\nPlease refer to the cited references for complete details.`;

    return {
      content,
      citations,
      modelName: 'mock-llm',
      promptTokens,
      completionTokens: Math.max(1, Math.ceil(content.length / 4)),
    };
  }
}
