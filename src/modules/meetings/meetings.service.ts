import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingAttendee } from './entities/meeting-attendee.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectMember, ProjectRole } from '../projects/entities/project-member.entity';
import { User } from '../users/entities/user.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { ListMeetingsQueryDto } from './dto/list-meetings-query.dto';
import { AuditService } from '../audit/audit.service';

const SORT_COLUMN_MAP: Record<string, string> = {
  startsAt: 'meeting.startsAt',
  title: 'meeting.title',
  createdAt: 'meeting.createdAt',
};

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
    @InjectRepository(MeetingAttendee)
    private readonly attendeeRepository: Repository<MeetingAttendee>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly memberRepository: Repository<ProjectMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    projectId: string,
    actorId: string,
    dto: CreateMeetingDto,
    requestId?: string,
  ): Promise<Meeting> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt <= startsAt) {
      throw new BadRequestException({
        code: 'INVALID_MEETING_TIME',
        message: 'Meeting endsAt must be strictly after startsAt.',
      });
    }

    if (dto.attendeeUserIds && dto.attendeeUserIds.length > 0) {
      await this.validateAttendeesInProject(dto.attendeeUserIds, projectId);
    }

    return this.dataSource.transaction(async (manager) => {
      const meeting = manager.create(Meeting, {
        projectId,
        title: dto.title.trim(),
        startsAt,
        endsAt,
        agenda: dto.agenda?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        transcriptText: dto.transcriptText?.trim() ?? null,
        transcriptVersion: 1,
        summary: null,
        createdBy: actorId,
        updatedBy: actorId,
        version: 1,
        deletedAt: null,
      });

      const saved = await manager.save(Meeting, meeting);

      if (dto.attendeeUserIds && dto.attendeeUserIds.length > 0) {
        const uniqueIds = Array.from(new Set(dto.attendeeUserIds));
        const attendees = uniqueIds.map((userId) =>
          manager.create(MeetingAttendee, {
            meetingId: saved.id,
            userId,
          }),
        );
        await manager.save(MeetingAttendee, attendees);
        saved.attendees = attendees;
      }

      await this.auditService.record({
        projectId,
        actorId,
        action: 'MEETING_CREATED',
        entityType: 'MEETING',
        entityId: saved.id,
        metadata: { title: saved.title },
        requestId,
      });

      return saved;
    });
  }

  async list(
    projectId: string,
    query: ListMeetingsQueryDto,
  ): Promise<{ data: Meeting[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'startsAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb: SelectQueryBuilder<Meeting> = this.meetingRepository
      .createQueryBuilder('meeting')
      .leftJoinAndSelect('meeting.attendees', 'attendees')
      .leftJoinAndSelect('attendees.user', 'user')
      .where('meeting.projectId = :projectId', { projectId })
      .andWhere('meeting.deletedAt IS NULL');

    if (query.from) {
      qb.andWhere('meeting.startsAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('meeting.startsAt <= :to', { to: new Date(query.to) });
    }
    if (query.search) {
      qb.andWhere(
        `to_tsvector('english', coalesce(meeting.title, '') || ' ' || coalesce(meeting.notes, '') || ' ' || coalesce(meeting.agenda, '')) @@ plainto_tsquery('english', :search)`,
        { search: query.search },
      );
    }

    const sortColumn = SORT_COLUMN_MAP[sortBy] ?? 'meeting.startsAt';
    qb.orderBy(sortColumn, sortOrder).addOrderBy('meeting.id', 'ASC');

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getById(projectId: string, meetingId: string): Promise<Meeting> {
    const meeting = await this.meetingRepository.findOne({
      where: { id: meetingId, projectId, deletedAt: IsNull() },
      relations: ['attendees', 'attendees.user'],
    });
    if (!meeting) {
      throw new NotFoundException({
        code: 'MEETING_NOT_FOUND',
        message: 'Meeting not found.',
      });
    }
    return meeting;
  }

  async update(
    projectId: string,
    meetingId: string,
    actorId: string,
    dto: UpdateMeetingDto,
    requestId?: string,
  ): Promise<Meeting> {
    const meeting = await this.getById(projectId, meetingId);

    if (meeting.version !== dto.version) {
      throw new ConflictException({
        code: 'CONCURRENCY_CONFLICT',
        message: 'Meeting has been modified by another request. Please reload.',
      });
    }

    const nextStartsAt = dto.startsAt ? new Date(dto.startsAt) : meeting.startsAt;
    const nextEndsAt = dto.endsAt ? new Date(dto.endsAt) : meeting.endsAt;

    if (nextEndsAt <= nextStartsAt) {
      throw new BadRequestException({
        code: 'INVALID_MEETING_TIME',
        message: 'Meeting endsAt must be strictly after startsAt.',
      });
    }

    if (dto.attendeeUserIds && dto.attendeeUserIds.length > 0) {
      await this.validateAttendeesInProject(dto.attendeeUserIds, projectId);
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.title !== undefined) meeting.title = dto.title.trim();
      if (dto.startsAt !== undefined) meeting.startsAt = nextStartsAt;
      if (dto.endsAt !== undefined) meeting.endsAt = nextEndsAt;
      if (dto.agenda !== undefined) meeting.agenda = dto.agenda ? dto.agenda.trim() : null;
      if (dto.notes !== undefined) meeting.notes = dto.notes ? dto.notes.trim() : null;

      if (dto.transcriptText !== undefined) {
        const trimmedTranscript = dto.transcriptText ? dto.transcriptText.trim() : null;
        if (trimmedTranscript !== meeting.transcriptText) {
          meeting.transcriptText = trimmedTranscript;
          meeting.transcriptVersion = (meeting.transcriptVersion ?? 1) + 1;
        }
      }

      if (dto.summary !== undefined) {
        meeting.summary = dto.summary ? dto.summary.trim() : null;
      }
      meeting.updatedBy = actorId;

      const saved = await manager.save(Meeting, meeting);

      if (dto.attendeeUserIds !== undefined) {
        await manager.delete(MeetingAttendee, { meetingId: saved.id });
        const uniqueIds = Array.from(new Set(dto.attendeeUserIds));
        if (uniqueIds.length > 0) {
          const attendees = uniqueIds.map((userId) =>
            manager.create(MeetingAttendee, {
              meetingId: saved.id,
              userId,
            }),
          );
          await manager.save(MeetingAttendee, attendees);
          saved.attendees = attendees;
        } else {
          saved.attendees = [];
        }
      }

      await this.auditService.record({
        projectId,
        actorId,
        action: 'MEETING_UPDATED',
        entityType: 'MEETING',
        entityId: saved.id,
        metadata: { title: saved.title, version: saved.version },
        requestId,
      });

      return saved;
    });
  }

  async softDelete(
    projectId: string,
    meetingId: string,
    actorId: string,
    actorRole: ProjectRole,
    requestId?: string,
  ): Promise<void> {
    const meeting = await this.getById(projectId, meetingId);

    if (actorRole === ProjectRole.CONTRIBUTOR && meeting.createdBy !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You can only delete meetings you created.',
      });
    }

    meeting.deletedAt = new Date();
    meeting.updatedBy = actorId;
    await this.meetingRepository.save(meeting);

    await this.auditService.record({
      projectId,
      actorId,
      action: 'MEETING_DELETED',
      entityType: 'MEETING',
      entityId: meeting.id,
      metadata: { title: meeting.title },
      requestId,
    });
  }

  private async validateAttendeesInProject(userIds: string[], projectId: string): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds));
    const activeMembers = await this.memberRepository.find({
      where: {
        projectId,
        userId: In(uniqueIds),
        removedAt: IsNull(),
      },
    });

    if (activeMembers.length !== uniqueIds.length) {
      throw new BadRequestException({
        code: 'INVALID_ATTENDEE',
        message: 'All meeting attendees must be active members of this project.',
      });
    }
  }
}
