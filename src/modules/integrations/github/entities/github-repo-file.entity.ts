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

@Entity('github_repo_files')
@Index('idx_github_repo_files_conn_path', ['connectionId', 'path'], { unique: true })
@Index('idx_github_repo_files_project', ['projectId'])
export class GitHubRepoFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId!: string;

  @ManyToOne(() => GitHubConnection, (conn) => conn.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection?: GitHubConnection;

  @Column({ type: 'varchar', length: 1000 })
  path!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ type: 'varchar', length: 50 })
  extension!: string;

  @Column({ type: 'integer', default: 0 })
  size!: number;

  @Column({ type: 'varchar', length: 100 })
  sha!: string;

  @Column({ name: 'html_url', type: 'varchar', length: 1000 })
  htmlUrl!: string;

  @Column({ name: 'synced_at', type: 'timestamptz' })
  syncedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
