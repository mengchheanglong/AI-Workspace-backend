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

@Entity('github_issues')
@Index('idx_github_issues_connection_number', ['connectionId', 'issueNumber'], { unique: true })
@Index('idx_github_issues_project_state', ['projectId', 'state'])
@Index('idx_github_issues_project_updated', ['projectId', 'githubUpdatedAt'])
export class GitHubIssue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId!: string;

  @ManyToOne(() => GitHubConnection, (conn) => conn.issues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection?: GitHubConnection;

  @Column({ name: 'github_issue_id', type: 'varchar', length: 100 })
  githubIssueId!: string;

  @Column({ name: 'issue_number', type: 'integer' })
  issueNumber!: number;

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
