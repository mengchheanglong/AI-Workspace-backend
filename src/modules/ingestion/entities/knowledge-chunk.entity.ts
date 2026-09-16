import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { KnowledgeSource } from './knowledge-source.entity';

@Entity('knowledge_chunks')
@Index('idx_knowledge_chunks_lookup', ['projectId', 'knowledgeSourceId', 'indexVersion'])
export class KnowledgeChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ name: 'knowledge_source_id', type: 'uuid' })
  knowledgeSourceId!: string;

  @ManyToOne(() => KnowledgeSource, (source) => source.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_source_id' })
  knowledgeSource?: KnowledgeSource;

  @Column({ name: 'index_version', type: 'integer' })
  indexVersion!: number;

  @Column({ name: 'chunk_index', type: 'integer' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  text!: string;

  @Column({ name: 'token_count', type: 'integer' })
  tokenCount!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @Column({
    name: 'embedding_model',
    type: 'varchar',
    length: 100,
    default: 'text-embedding-3-small',
  })
  embeddingModel!: string;

  @Column({ name: 'embedding_dimensions', type: 'integer', default: 1536 })
  embeddingDimensions!: number;

  @Column({
    type: 'text',
    transformer: {
      to: (val: number[] | string): string => {
        if (Array.isArray(val)) {
          return `[${val.join(',')}]`;
        }
        return val;
      },
      from: (val: string | number[]): number[] => {
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val ?? [];
      },
    },
  })
  embedding!: number[] | string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
