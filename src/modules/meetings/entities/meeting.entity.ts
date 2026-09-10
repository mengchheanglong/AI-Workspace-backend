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
import { MeetingAttendee } from './meeting-attendee.entity';

@Entity('meetings')
@Index('idx_meetings_project_starts_at', ['projectId', 'deletedAt', 'startsAt'])
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date;

  @Column({ type: 'text', nullable: true })
  agenda!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'transcript_text', type: 'text', nullable: true })
  transcriptText!: string | null;

  @Column({ name: 'transcript_version', type: 'integer', default: 1 })
  transcriptVersion!: number;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

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

  @OneToMany(() => MeetingAttendee, (attendee) => attendee.meeting)
  attendees?: MeetingAttendee[];
}
