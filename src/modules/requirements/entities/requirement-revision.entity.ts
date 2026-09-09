import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Requirement } from './requirement.entity';
import { User } from '../../users/entities/user.entity';

@Entity('requirement_revisions')
export class RequirementRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'requirement_id', type: 'uuid' })
  requirementId!: string;

  @ManyToOne(() => Requirement, (req) => req.revisions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requirement_id' })
  requirement?: Requirement;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'acceptance_criteria', type: 'text', nullable: true })
  acceptanceCriteria!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ type: 'varchar', length: 20 })
  priority!: string;

  @Column({ name: 'changed_by', type: 'uuid' })
  changedBy!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by' })
  changer?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
