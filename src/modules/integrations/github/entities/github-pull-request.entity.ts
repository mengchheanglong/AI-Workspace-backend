import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../../projects/entities/project.entity';
import { GitHubConnection } from './github-connection.entity';

@Entity('github_pull_requests')
@Index('idx_github_prs_connection_number', ['connectionId', 'prNumber'], { unique: true })
@Index('idx_github_prs_project_state', ['projectId', 'state'])
@Index('idx_github_prs_project_updated', ['projectId', 'githubUpdatedAt'])
export class GitHubPullRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId!: string;

  @ManyToOne(() => GitHubConnection, (conn) => conn.pullRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection?: GitHubConnection;

  @Column({ name: 'github_pr_id', type: 'varchar', length: 100 })
  githubPrId!: string;

  @Column({ name: 'pr_number', type: 'integer' })
  prNumber!: number;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'open' })
  state!: string;

  @Column({ name: 'html_url', type: 'varchar', length: 1000 })
  htmlUrl!: string;

  @Column({ name: 'author_login', type: 'varchar', length: 100, nullable: true })
  authorLogin!: string | null;

  @Column({ name: 'base_branch', type: 'varchar', length: 200, nullable: true })
  baseBranch!: string | null;

  @Column({ name: 'head_branch', type: 'varchar', length: 200, nullable: true })
  headBranch!: string | null;

  @Column({ name: 'is_merged', type: 'boolean', default: false })
  isMerged!: boolean;

  @Column({ name: 'merged_at', type: 'timestamptz', nullable: true })
  mergedAt!: Date | null;

  @Column({ type: 'jsonb', default: '[]' })
  labels!: string[];

  @Column({ name: 'github_created_at', type: 'timestamptz' })
  githubCreatedAt!: Date;

  @Column({ name: 'github_updated_at', type: 'timestamptz' })
  githubUpdatedAt!: Date;

  @Column({ name: 'synced_at', type: 'timestamptz' })
  syncedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
