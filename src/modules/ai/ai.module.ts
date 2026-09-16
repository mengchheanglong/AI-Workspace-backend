import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { IngestionModule } from '../ingestion/ingestion.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ContextAssembler } from './context/context-assembler';
import { ChatMessage } from './entities/chat-message.entity';
import { Conversation } from './entities/conversation.entity';
import { DeepSeekLlmProvider, MockLlmProvider } from './llm';
import { RetrievalService } from './retrieval/retrieval.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ChatMessage, Project, ProjectMember]),
    IngestionModule,
  ],
  controllers: [AiController],
  providers: [
    RetrievalService,
    ContextAssembler,
    AiService,
    {
      provide: 'LLM_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const aiEnabled = configService.get<boolean>('AI_ENABLED');
        const apiKey = configService.get<string>('DEEPSEEK_API_KEY');
        const baseUrl =
          configService.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com';
        const model = configService.get<string>('AI_CHAT_MODEL') || 'deepseek-v4-pro';

        if (aiEnabled && apiKey) {
          return new DeepSeekLlmProvider(apiKey, baseUrl, model);
        }
        return new MockLlmProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [AiService, RetrievalService, ContextAssembler, 'LLM_PROVIDER'],
})
export class AiModule {}
