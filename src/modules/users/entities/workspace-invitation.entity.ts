import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProfessionalRole, SystemRole, User } from './user.entity';

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity('workspace_invitations')
export class WorkspaceInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({
    name: 'system_role',
    type: 'varchar',
    length: 20,
    default: SystemRole.USER,
  })
  systemRole!: SystemRole;

  @Column({
    name: 'professional_role',
    type: 'varchar',
    length: 30,
    default: ProfessionalRole.DEVELOPER,
  })
  professionalRole!: ProfessionalRole;

  @Index('idx_workspace_invitations_token', { unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  token!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: InvitationStatus.PENDING,
  })
  status!: InvitationStatus;

  @Column({ name: 'invited_by_id', type: 'uuid', nullable: true })
  invitedById?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invited_by_id' })
  invitedBy?: User | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;
}
