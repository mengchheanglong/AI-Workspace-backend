import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Meeting } from './meeting.entity';
import { User } from '../../users/entities/user.entity';

@Entity('meeting_attendees')
export class MeetingAttendee {
  @PrimaryColumn({ name: 'meeting_id', type: 'uuid' })
  meetingId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => Meeting, (m) => m.attendees, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting?: Meeting;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
