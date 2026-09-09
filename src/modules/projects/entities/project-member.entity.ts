import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Project } from './project.entity';

export enum ProjectRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  CONTRIBUTOR = 'CONTRIBUTOR',
  VIEWER = 'VIEWER',
}

@Entity('project_members')
@Index('idx_project_members_active_user', ['projectId', 'userId'], {
  unique: true,
  where: '"removed_at" IS NULL',
})
@Index('idx_project_members_single_owner', ['projectId'], {
  unique: true,
  where: `"access_role" = 'OWNER' AND "removed_at" IS NULL`,
})
@Index('idx_project_members_user_active', ['userId', 'removedAt'])
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    name: 'access_role',
    type: 'varchar',
    length: 20,
  })
  accessRole!: ProjectRole;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removedAt!: Date | null;
}
