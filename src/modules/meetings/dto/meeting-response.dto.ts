import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Meeting } from '../entities/meeting.entity';

export class MeetingAttendeeDto {
  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  userId!: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  displayName?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  email?: string;
}

export class MeetingResponseDto {
  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  id!: string;

  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  projectId!: string;

  @ApiProperty({ example: 'Sprint Planning' })
  title!: string;

  @ApiProperty({ example: '2026-09-15T09:00:00.000Z' })
  startsAt!: string;

  @ApiProperty({ example: '2026-09-15T10:00:00.000Z' })
  endsAt!: string;

  @ApiPropertyOptional({ example: 'Agenda text', nullable: true })
  agenda!: string | null;

  @ApiPropertyOptional({ example: 'Notes text', nullable: true })
  notes!: string | null;

  @ApiPropertyOptional({ example: 'Transcript text', nullable: true })
  transcriptText!: string | null;

  @ApiProperty({ example: 1 })
  transcriptVersion!: number;

  @ApiPropertyOptional({ example: 'Approved summary', nullable: true })
  summary!: string | null;

  @ApiProperty({ type: [MeetingAttendeeDto] })
  attendees!: MeetingAttendeeDto[];

  @ApiProperty()
  createdBy!: string;

  @ApiProperty()
  updatedBy!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: '2026-09-10T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-10T10:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(
    meeting: Meeting,
    attendeeUsers?: { id: string; displayName: string; email: string }[],
  ): MeetingResponseDto {
    const attendees: MeetingAttendeeDto[] = attendeeUsers
      ? attendeeUsers.map((u) => ({
          userId: u.id,
          displayName: u.displayName,
          email: u.email,
        }))
      : meeting.attendees
        ? meeting.attendees.map((a) => ({
            userId: a.userId,
            displayName: a.user?.displayName,
            email: a.user?.email,
          }))
        : [];

    return {
      id: meeting.id,
      projectId: meeting.projectId,
      title: meeting.title,
      startsAt:
        meeting.startsAt instanceof Date ? meeting.startsAt.toISOString() : meeting.startsAt,
      endsAt: meeting.endsAt instanceof Date ? meeting.endsAt.toISOString() : meeting.endsAt,
      agenda: meeting.agenda,
      notes: meeting.notes,
      transcriptText: meeting.transcriptText,
      transcriptVersion: meeting.transcriptVersion,
      summary: meeting.summary,
      attendees,
      createdBy: meeting.createdBy,
      updatedBy: meeting.updatedBy,
      version: meeting.version,
      createdAt:
        meeting.createdAt instanceof Date ? meeting.createdAt.toISOString() : meeting.createdAt,
      updatedAt:
        meeting.updatedAt instanceof Date ? meeting.updatedAt.toISOString() : meeting.updatedAt,
    };
  }
}
