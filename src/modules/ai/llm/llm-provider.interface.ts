import { CitationItem } from '../entities/chat-message.entity';
import { RetrievedEvidence } from '../retrieval/retrieval.service';

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateAnswerParams {
  messages: ChatCompletionMessage[];
  evidence: RetrievedEvidence[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateAnswerResult {
  content: string;
  citations: CitationItem[];
  modelName: string;
  promptTokens: number;
  completionTokens: number;
}

export interface LlmProvider {
  generateAnswer(params: GenerateAnswerParams): Promise<GenerateAnswerResult>;
}
