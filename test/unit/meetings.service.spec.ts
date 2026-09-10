import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MeetingsService } from '../../src/modules/meetings/meetings.service';
import { Meeting } from '../../src/modules/meetings/entities/meeting.entity';
import { MeetingAttendee } from '../../src/modules/meetings/entities/meeting-attendee.entity';
import { Project } from '../../src/modules/projects/entities/project.entity';
import {
  ProjectMember,
  ProjectRole,
} from '../../src/modules/projects/entities/project-member.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { AuditService } from '../../src/modules/audit/audit.service';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';
const ACTOR_ID = '22222222-2222-2222-2222-222222222222';
const ATTENDEE_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_USER = '44444444-4444-4444-4444-444444444444';
const MEETING_ID = '55555555-5555-5555-5555-555555555555';

function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  const now = new Date();
  const startsAt = new Date(now.getTime() + 3600000);
  const endsAt = new Date(startsAt.getTime() + 3600000);
  return {
    id: MEETING_ID,
    projectId: PROJECT_ID,
    title: 'Sprint Planning',
    startsAt,
    endsAt,
    agenda: 'Agenda',
    notes: 'Notes',
    transcriptText: null,
    transcriptVersion: 1,
    summary: null,
    createdBy: ACTOR_ID,
    updatedBy: ACTOR_ID,
    version: 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    attendees: [],
    ...overrides,
  } as Meeting;
}

describe('MeetingsService', () => {
  let service: MeetingsService;

  const mockMeetingRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockAttendeeRepo = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockProjectRepo = {
    findOne: jest.fn(),
  };

  const mockMemberRepo = {
    find: jest.fn(),
  };

  const mockUserRepo = {
    find: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const mockTransactionManager = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: (manager: typeof mockTransactionManager) => Promise<unknown>) =>
      cb(mockTransactionManager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: getRepositoryToken(Meeting), useValue: mockMeetingRepo },
        { provide: getRepositoryToken(MeetingAttendee), useValue: mockAttendeeRepo },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(ProjectMember), useValue: mockMemberRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(MeetingsService);
  });

  describe('create', () => {
    it('should create meeting with attendees and audit log', async () => {
      mockMemberRepo.find.mockResolvedValue([{ userId: ATTENDEE_ID }]);
      const meeting = makeMeeting();
      mockTransactionManager.create.mockReturnValue(meeting);
      mockTransactionManager.save.mockResolvedValue(meeting);

      const result = await service.create(PROJECT_ID, ACTOR_ID, {
        title: 'Sprint Planning',
        startsAt: '2026-09-15T09:00:00.000Z',
        endsAt: '2026-09-15T10:00:00.000Z',
        attendeeUserIds: [ATTENDEE_ID],
      });

      expect(result.title).toBe('Sprint Planning');
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MEETING_CREATED' }),
      );
    });

    it('should throw BadRequestException if endsAt <= startsAt', async () => {
      await expect(
        service.create(PROJECT_ID, ACTOR_ID, {
          title: 'Invalid Time',
          startsAt: '2026-09-15T10:00:00.000Z',
          endsAt: '2026-09-15T09:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if attendee is not active project member', async () => {
      mockMemberRepo.find.mockResolvedValue([]); // No matching members

      await expect(
        service.create(PROJECT_ID, ACTOR_ID, {
          title: 'Planning',
          startsAt: '2026-09-15T09:00:00.000Z',
          endsAt: '2026-09-15T10:00:00.000Z',
          attendeeUserIds: [ATTENDEE_ID],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getById', () => {
    it('should return meeting with attendees', async () => {
      const meeting = makeMeeting();
      mockMeetingRepo.findOne.mockResolvedValue(meeting);

      const result = await service.getById(PROJECT_ID, MEETING_ID);
      expect(result.id).toBe(MEETING_ID);
    });

    it('should throw NotFoundException if meeting not found', async () => {
      mockMeetingRepo.findOne.mockResolvedValue(null);
      await expect(service.getById(PROJECT_ID, MEETING_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update meeting and increment transcriptVersion when transcript changed', async () => {
      const meeting = makeMeeting({
        version: 1,
        transcriptText: 'Original text',
        transcriptVersion: 1,
      });
      mockMeetingRepo.findOne.mockResolvedValue(meeting);
      mockTransactionManager.save.mockImplementation(
        async (_cls: unknown, entity: Meeting) => entity,
      );

      const result = await service.update(PROJECT_ID, MEETING_ID, ACTOR_ID, {
        version: 1,
        transcriptText: 'Updated transcript text',
      });

      expect(result.transcriptVersion).toBe(2);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MEETING_UPDATED' }),
      );
    });

    it('should throw ConflictException on version mismatch', async () => {
      const meeting = makeMeeting({ version: 2 });
      mockMeetingRepo.findOne.mockResolvedValue(meeting);

      await expect(
        service.update(PROJECT_ID, MEETING_ID, ACTOR_ID, { version: 1, title: 'Stale' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException on invalid updated time', async () => {
      const meeting = makeMeeting({ version: 1 });
      mockMeetingRepo.findOne.mockResolvedValue(meeting);

      await expect(
        service.update(PROJECT_ID, MEETING_ID, ACTOR_ID, {
          version: 1,
          startsAt: '2026-09-15T11:00:00.000Z',
          endsAt: '2026-09-15T10:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('softDelete', () => {
    it('should allow Owner to delete any meeting', async () => {
      const meeting = makeMeeting({ createdBy: OTHER_USER });
      mockMeetingRepo.findOne.mockResolvedValue(meeting);
      mockMeetingRepo.save.mockResolvedValue(meeting);

      await service.softDelete(PROJECT_ID, MEETING_ID, ACTOR_ID, ProjectRole.OWNER);
      expect(meeting.deletedAt).not.toBeNull();
    });

    it('should allow Contributor to delete own meeting', async () => {
      const meeting = makeMeeting({ createdBy: ACTOR_ID });
      mockMeetingRepo.findOne.mockResolvedValue(meeting);
      mockMeetingRepo.save.mockResolvedValue(meeting);

      await service.softDelete(PROJECT_ID, MEETING_ID, ACTOR_ID, ProjectRole.CONTRIBUTOR);
      expect(meeting.deletedAt).not.toBeNull();
    });

    it('should forbid Contributor from deleting others meeting', async () => {
      const meeting = makeMeeting({ createdBy: OTHER_USER });
      mockMeetingRepo.findOne.mockResolvedValue(meeting);

      await expect(
        service.softDelete(PROJECT_ID, MEETING_ID, ACTOR_ID, ProjectRole.CONTRIBUTOR),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
