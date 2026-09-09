import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { RequirementRevision } from './requirement-revision.entity';

export enum RequirementStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  ARCHIVED = 'ARCHIVED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Entity('requirements')
@Index('idx_requirements_project_status', ['projectId', 'deletedAt', 'status'])
export class Requirement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ type: 'integer' })
  number!: number;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'acceptance_criteria', type: 'text', nullable: true })
  acceptanceCriteria!: string | null;

  @Column({ type: 'varchar', length: 20, default: RequirementStatus.DRAFT })
  status!: RequirementStatus;

  @Column({ type: 'varchar', length: 20, default: Priority.MEDIUM })
  priority!: Priority;

  @Column({ name: 'source_meeting_id', type: 'uuid', nullable: true })
  sourceMeetingId!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @Column({ name: 'updated_by', type: 'uuid' })
  updatedBy!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updated_by' })
  updater?: User;

  @VersionColumn({ default: 1 })
  version!: number;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => RequirementRevision, (rev) => rev.requirement)
  revisions?: RequirementRevision[];
}
