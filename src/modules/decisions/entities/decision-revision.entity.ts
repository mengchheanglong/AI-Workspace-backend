import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Decision } from './decision.entity';
import { User } from '../../users/entities/user.entity';

@Entity('decision_revisions')
export class DecisionRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'decision_id', type: 'uuid' })
  decisionId!: string;

  @ManyToOne(() => Decision, (dec) => dec.revisions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'decision_id' })
  decision?: Decision;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ name: 'decision_text', type: 'text' })
  decisionText!: string;

  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ name: 'changed_by', type: 'uuid' })
  changedBy!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by' })
  changer?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
