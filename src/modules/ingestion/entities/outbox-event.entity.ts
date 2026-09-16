import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 255 })
  dedupeKey!: string;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'dispatched_at', type: 'timestamptz', nullable: true })
  dispatchedAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
