import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Session } from '../../auth/entities/session.entity';

export enum SystemRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum ProfessionalRole {
  PM = 'PM',
  DEVELOPER = 'DEVELOPER',
  QA = 'QA',
  DX = 'DX',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  PRESENTATION = 'PRESENTATION',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_users_email_lower', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

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

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Session, (session) => session.user)
  sessions?: Session[];
}
