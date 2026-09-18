import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProposalsService } from '../../src/modules/ai/proposals.service';
import {
  AIProposal,
  ProposalStatus,
  ProposalType,
} from '../../src/modules/ai/entities/proposal.entity';
import { ProposalCommit } from '../../src/modules/ai/entities/proposal-commit.entity';
import {
  Priority,
  Requirement,
  RequirementStatus,
} from '../../src/modules/requirements/entities/requirement.entity';
import { Meeting } from '../../src/modules/meetings/entities/meeting.entity';
import { Task } from '../../src/modules/tasks/entities/task.entity';
import { Decision } from '../../src/modules/decisions/entities/decision.entity';
import { Project, ProjectStatus } from '../../src/modules/projects/entities/project.entity';
import { ProjectRole } from '../../src/modules/projects/entities/project-member.entity';
import { User, SystemRole } from '../../src/modules/users/entities/user.entity';
import { MockLlmProvider } from '../../src/modules/ai/llm/mock-llm-provider';

describe('ProposalsService', () => {
  let service: ProposalsService;
  let mockProposalRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockCommitRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let mockReqRepo: {
    findOne: jest.Mock;
  };
  let mockMeetingRepo: {
    findOne: jest.Mock;
  };
  let mockTaskRepo: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let mockDecisionRepo: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let mockProjectRepo: {
    findOne: jest.Mock;
  };
  let mockMemberRepo: {
    findOne: jest.Mock;
  };
  let mockLlmProvider: MockLlmProvider;
  let mockAuditService: {
    record: jest.Mock;
  };
  let mockOutboxService: {
    emit: jest.Mock;
  };
  let mockDataSource: {
    transaction: jest.Mock;
  };

  const mockProjectId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockActor = {
    id: mockUserId,
    email: 'alice@example.com',
    displayName: 'Alice Test',
    passwordHash: 'hash',
    systemRole: SystemRole.USER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockProject = {
    id: mockProjectId,
    name: 'Alpha Workspace',
    key: 'AIW',
    description: 'Test project',
    status: ProjectStatus.ACTIVE,
    createdBy: mockUserId,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Project;

  const mockRequirement: Requirement = {
    id: '33333333-3333-3333-3333-333333333333',
    projectId: mockProjectId,
    number: 1,
    title: 'Requirement Status Filter',
    description: 'Filter requirements by status in the UI',
    acceptanceCriteria: '1. Filter dropdown shown. 2. Filter applied to list.',
    status: RequirementStatus.APPROVED,
    priority: Priority.HIGH,
    sourceMeetingId: null,
    createdBy: mockUserId,
    updatedBy: mockUserId,
    version: 2,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMeeting: Meeting = {
    id: '44444444-4444-4444-4444-444444444444',
    projectId: mockProjectId,
    title: 'Sprint Planning Meeting',
    startsAt: new Date('2026-09-17T10:00:00Z'),
    endsAt: new Date('2026-09-17T11:00:00Z'),
    agenda: 'Discuss Q3 deliverables',
    notes: 'Agreed on implementing PostgreSQL vector store and task proposals.',
    transcriptText: 'Alice: Let us adopt vector embeddings. Bob: Agreed, let us use 1536 dim.',
    transcriptVersion: 3,
    summary: null,
    createdBy: mockUserId,
    updatedBy: mockUserId,
    version: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockProposalRepo = {
      create: jest.fn((dto: unknown) => ({
        id: 'prop-123',
        ...(dto as object),
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: jest.fn((entity: { id?: string }) =>
        Promise.resolve({ id: entity.id || 'prop-123', ...entity }),
      ),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    mockCommitRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto: unknown) => ({ id: 'commit-123', ...(dto as object) })),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };

    mockReqRepo = {
      findOne: jest.fn(),
    };

    mockMeetingRepo = {
      findOne: jest.fn(),
    };

    mockTaskRepo = {
      create: jest.fn((dto: unknown) => ({ id: 'task-123', ...(dto as object) })),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };

    mockDecisionRepo = {
      create: jest.fn((dto: unknown) => ({ id: 'dec-123', ...(dto as object) })),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };

    mockProjectRepo = {
      findOne: jest.fn().mockResolvedValue(mockProject),
    };

    mockMemberRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'mem-1',
        projectId: mockProjectId,
        userId: mockUserId,
        accessRole: ProjectRole.MANAGER,
        removedAt: null,
      }),
    };

    mockLlmProvider = new MockLlmProvider();

    mockAuditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    mockOutboxService = {
      emit: jest.fn().mockResolvedValue(undefined),
    };

    mockDataSource = {
      transaction: jest.fn(async (callback: (manager: unknown) => Promise<unknown>) => {
        const mockManager = {
          findOne: jest.fn(),
          query: jest.fn().mockResolvedValue([{ max: 0 }]),
          create: jest.fn((_entityClass: unknown, plainObject: object) => ({
            id: 'generated-uuid-1',
            ...plainObject,
          })),
          save: jest.fn((_entityClass: unknown, plainObject: object) =>
            Promise.resolve({ id: 'saved-uuid-1', ...plainObject }),
          ),
          createQueryBuilder: jest.fn(() => ({
            innerJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
          })),
        };
        return callback(mockManager);
      }),
    };

    service = new ProposalsService(
      mockProposalRepo as never,
      mockCommitRepo as never,
      mockReqRepo as never,
      mockMeetingRepo as never,
      mockTaskRepo as never,
      mockDecisionRepo as never,
      mockProjectRepo as never,
      mockMemberRepo as never,
      mockLlmProvider,
      mockAuditService as never,
      mockOutboxService as never,
      mockDataSource as never,
    );
  });

  describe('generateTaskProposal', () => {
    it('should generate structured task proposals from a requirement', async () => {
      mockReqRepo.findOne.mockResolvedValue(mockRequirement);

      const result = await service.generateTaskProposal(
        mockProjectId,
        mockUserId,
        mockRequirement.id,
      );

      expect(result).toBeDefined();
      expect(result.proposalType).toBe(ProposalType.TASK_PROPOSAL);
      expect(result.sourceEntityType).toBe('REQUIREMENT');
      expect(result.sourceEntityId).toBe(mockRequirement.id);
      expect(result.sourceRevision).toBe(mockRequirement.version);
      expect(result.status).toBe(ProposalStatus.PENDING);
      const draft = result.draftJson as { type: string; items: unknown[] };
      expect(draft.type).toBe('CREATE_TASKS');
      expect(draft.items.length).toBeGreaterThan(0);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AI_TASK_PROPOSAL_GENERATED',
          projectId: mockProjectId,
        }),
      );
    });

    it('should throw NotFoundException if requirement does not exist', async () => {
      mockReqRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateTaskProposal(mockProjectId, mockUserId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateMeetingAnalysis', () => {
    it('should generate meeting analysis with summary, decisions, requirements, and tasks', async () => {
      mockMeetingRepo.findOne.mockResolvedValue(mockMeeting);

      const result = await service.generateMeetingAnalysis(
        mockProjectId,
        mockUserId,
        mockMeeting.id,
      );

      expect(result).toBeDefined();
      expect(result.proposalType).toBe(ProposalType.MEETING_ANALYSIS);
      expect(result.sourceEntityType).toBe('MEETING');
      expect(result.sourceRevision).toBe(mockMeeting.transcriptVersion);
      const draft = result.draftJson as {
        type: string;
        summary: string;
        decisions: unknown[];
        requirements: unknown[];
        actionItems: unknown[];
      };
      expect(draft.type).toBe('MEETING_ANALYSIS');
      expect(draft.summary).toBeDefined();
      expect(draft.decisions.length).toBeGreaterThan(0);
      expect(draft.requirements.length).toBeGreaterThan(0);
      expect(draft.actionItems.length).toBeGreaterThan(0);
    });

    it('should throw BadRequestException if meeting has no notes or transcript', async () => {
      mockMeetingRepo.findOne.mockResolvedValue({
        ...mockMeeting,
        agenda: null,
        notes: null,
        transcriptText: null,
      });

      await expect(
        service.generateMeetingAnalysis(mockProjectId, mockUserId, mockMeeting.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProposal', () => {
    it('should update draft items and increment proposal version', async () => {
      const existingProposal = {
        id: 'prop-123',
        projectId: mockProjectId,
        userId: mockUserId,
        proposalType: ProposalType.TASK_PROPOSAL,
        sourceEntityType: 'REQUIREMENT',
        sourceEntityId: mockRequirement.id,
        sourceRevision: 2,
        draftJson: {
          type: 'CREATE_TASKS',
          items: [
            {
              itemId: 'draft-item-1',
              title: 'Original Title',
              priority: Priority.MEDIUM,
              sourceIds: [],
            },
          ],
        },
        version: 1,
        status: ProposalStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        confirmedBy: null,
        confirmedAt: null,
        resultRecordIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AIProposal;

      mockProposalRepo.findOne.mockResolvedValue(existingProposal);

      const updated = await service.updateProposal(mockProjectId, mockUserId, 'prop-123', {
        version: 1,
        draftJson: {
          type: 'CREATE_TASKS',
          items: [
            {
              itemId: 'draft-item-1',
              title: 'Updated Task Title',
              priority: Priority.HIGH,
              sourceIds: [],
            },
          ],
        },
      });

      expect(updated.version).toBe(2);
      const draft = updated.draftJson as { items: Array<{ title: string }> };
      expect(draft.items[0]!.title).toBe('Updated Task Title');
    });

    it('should throw ConflictException on version mismatch (optimistic locking)', async () => {
      const existingProposal = {
        id: 'prop-123',
        projectId: mockProjectId,
        userId: mockUserId,
        proposalType: ProposalType.TASK_PROPOSAL,
        sourceEntityType: 'REQUIREMENT',
        sourceEntityId: mockRequirement.id,
        sourceRevision: 2,
        draftJson: { type: 'CREATE_TASKS', items: [] },
        version: 2,
        status: ProposalStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        confirmedBy: null,
        confirmedAt: null,
        resultRecordIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AIProposal;

      mockProposalRepo.findOne.mockResolvedValue(existingProposal);

      await expect(
        service.updateProposal(mockProjectId, mockUserId, 'prop-123', {
          version: 1, // Stale version
          draftJson: { type: 'CREATE_TASKS', items: [] },
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rejectProposal', () => {
    it('should set status to REJECTED without modifying domain tables', async () => {
      const existingProposal = {
        id: 'prop-123',
        projectId: mockProjectId,
        userId: mockUserId,
        proposalType: ProposalType.TASK_PROPOSAL,
        sourceEntityType: 'REQUIREMENT',
        sourceEntityId: mockRequirement.id,
        sourceRevision: 2,
        draftJson: { type: 'CREATE_TASKS', items: [] },
        version: 1,
        status: ProposalStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        confirmedBy: null,
        confirmedAt: null,
        resultRecordIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AIProposal;

      mockProposalRepo.findOne.mockResolvedValue(existingProposal);

      const rejected = await service.rejectProposal(mockProjectId, mockUserId, 'prop-123');
      expect(rejected.status).toBe(ProposalStatus.REJECTED);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AI_PROPOSAL_REJECTED' }),
      );
    });
  });

  describe('confirmProposal', () => {
    it('should replay result on identical idempotency key', async () => {
      const existingCommit: ProposalCommit = {
        id: 'commit-1',
        proposalId: 'prop-123',
        projectId: mockProjectId,
        actorId: mockUserId,
        idempotencyKey: 'idem-key-abc',
        payloadHash: '4ba4fdf24df39c14828ce3722a45d7d3c01c0cf9a9cb84e1bba92fd6b50937c4',
        resultRecordIds: [{ entityType: 'TASK', id: 'task-1', key: 'AIW-TSK-1' }],
        createdAt: new Date(),
      };

      mockCommitRepo.findOne.mockImplementation(
        ({ where }: { where: { idempotencyKey?: string } }) => {
          if (where.idempotencyKey === 'idem-key-abc') {
            const hash = createHash('sha256')
              .update(JSON.stringify({ proposalId: 'prop-123', dto: { version: 1 } }))
              .digest('hex');
            return Promise.resolve({ ...existingCommit, payloadHash: hash });
          }
          return Promise.resolve(null);
        },
      );

      mockProposalRepo.findOne.mockResolvedValue({
        id: 'prop-123',
        status: ProposalStatus.CONFIRMED,
      });

      const res = await service.confirmProposal(
        mockProjectId,
        mockActor,
        'prop-123',
        { version: 1 },
        'idem-key-abc',
      );

      expect(res.resultRecordIds).toEqual(existingCommit.resultRecordIds);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should reject viewer role from confirming proposals', async () => {
      mockMemberRepo.findOne.mockResolvedValue({
        id: 'mem-1',
        projectId: mockProjectId,
        userId: mockUserId,
        accessRole: ProjectRole.VIEWER,
        removedAt: null,
      });

      await expect(
        service.confirmProposal(mockProjectId, mockActor, 'prop-123', { version: 1 }, 'key-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject confirmation with ConflictException if source requirement revision changed', async () => {
      const pendingProposal = {
        id: 'prop-123',
        projectId: mockProjectId,
        userId: mockUserId,
        proposalType: ProposalType.TASK_PROPOSAL,
        sourceEntityType: 'REQUIREMENT',
        sourceEntityId: mockRequirement.id,
        sourceRevision: 1, // Proposal was based on revision 1
        draftJson: {
          type: 'CREATE_TASKS',
          items: [
            {
              itemId: 'draft-item-1',
              title: 'Task 1',
              priority: Priority.MEDIUM,
              sourceIds: [],
            },
          ],
        },
        version: 1,
        status: ProposalStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        confirmedBy: null,
        confirmedAt: null,
        resultRecordIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AIProposal;

      mockDataSource.transaction = jest.fn(
        async (
          cb: (manager: {
            findOne: (entityClass: unknown) => Promise<unknown>;
          }) => Promise<unknown>,
        ) => {
          const mockManager = {
            findOne: jest.fn((entityClass: unknown) => {
              if (entityClass === AIProposal) return Promise.resolve(pendingProposal);
              if (entityClass === Requirement)
                return Promise.resolve({ ...mockRequirement, version: 3 }); // Requirement evolved to version 3!
              return Promise.resolve(null);
            }),
          };
          return cb(mockManager);
        },
      );

      await expect(
        service.confirmProposal(mockProjectId, mockActor, 'prop-123', { version: 1 }, 'key-new'),
      ).rejects.toThrow(ConflictException);
    });

    it('should transactionally create tasks and commit proposal on valid confirmation', async () => {
      const pendingProposal = {
        id: 'prop-123',
        projectId: mockProjectId,
        userId: mockUserId,
        proposalType: ProposalType.TASK_PROPOSAL,
        sourceEntityType: 'REQUIREMENT',
        sourceEntityId: mockRequirement.id,
        sourceRevision: 2,
        draftJson: {
          type: 'CREATE_TASKS',
          items: [
            {
              itemId: 'draft-item-1',
              title: 'Implement feature backend',
              description: 'REST API implementation',
              priority: Priority.HIGH,
              sourceIds: [mockRequirement.id],
            },
          ],
        },
        version: 1,
        status: ProposalStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        confirmedBy: null,
        confirmedAt: null,
        resultRecordIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AIProposal;

      let capturedTask: Task | null = null;
      let capturedCommit: ProposalCommit | null = null;

      mockDataSource.transaction = jest.fn(
        async (
          cb: (manager: {
            findOne: (entityClass: unknown) => Promise<unknown>;
            query: () => Promise<unknown>;
            create: (entityClass: unknown, plainObject: unknown) => unknown;
            save: (entityClass: unknown, plainObject: unknown) => Promise<unknown>;
          }) => Promise<unknown>,
        ) => {
          const mockManager = {
            findOne: jest.fn((entityClass: unknown) => {
              if (entityClass === AIProposal) return Promise.resolve(pendingProposal);
              if (entityClass === Requirement) return Promise.resolve(mockRequirement);
              return Promise.resolve(null);
            }),
            query: jest.fn().mockResolvedValue([{ max: 5 }]),
            create: jest.fn((_entityClass: unknown, plainObject: unknown) => ({
              id: 'gen-uuid',
              ...(plainObject as object),
            })),
            save: jest.fn((entityClass: unknown, plainObject: unknown) => {
              if (entityClass === Task) capturedTask = plainObject as Task;
              if (entityClass === ProposalCommit) capturedCommit = plainObject as ProposalCommit;
              return Promise.resolve({ id: 'saved-id', ...(plainObject as object) });
            }),
          };
          return cb(mockManager);
        },
      );

      const res = await service.confirmProposal(
        mockProjectId,
        mockActor,
        'prop-123',
        { version: 1 },
        'key-create-task',
      );

      expect(res.resultRecordIds).toHaveLength(1);
      expect(res.resultRecordIds[0]!.entityType).toBe('TASK');
      expect(res.resultRecordIds[0]!.key).toBe('AIW-TSK-6'); // nextNumber was 6
      expect(capturedTask).not.toBeNull();
      expect(capturedTask!.number).toBe(6);
      expect(capturedTask!.title).toBe('Implement feature backend');
      expect(capturedTask!.requirementId).toBe(mockRequirement.id);
      expect(capturedTask!.sourceMeetingId).toBeNull();
      expect(capturedCommit).not.toBeNull();
      expect(capturedCommit!.idempotencyKey).toBe('key-create-task');
      expect(mockOutboxService.emit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: 'TASK_CREATED' }),
      );
    });

    it('should throw ConflictException if idempotency key is reused with mismatched payload hash', async () => {
      const existingCommit: ProposalCommit = {
        id: 'commit-diff',
        proposalId: 'prop-123',
        projectId: mockProjectId,
        actorId: mockUserId,
        idempotencyKey: 'key-reused',
        payloadHash: 'hash-of-original-payload',
        resultRecordIds: [{ entityType: 'TASK', id: 'task-orig', key: 'AIW-TSK-1' }],
        createdAt: new Date(),
      };

      mockCommitRepo.findOne.mockResolvedValue(existingCommit);

      await expect(
        service.confirmProposal(
          mockProjectId,
          mockActor,
          'prop-123',
          { version: 1, selectedItemIds: ['different-item'] },
          'key-reused',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create tasks from meeting analysis and link them correctly to sourceMeetingId', async () => {
      const meetingProposal = {
        id: 'prop-meeting-123',
        projectId: mockProjectId,
        userId: mockUserId,
        proposalType: ProposalType.MEETING_ANALYSIS,
        sourceEntityType: 'MEETING',
        sourceEntityId: mockMeeting.id,
        sourceRevision: 3,
        draftJson: {
          type: 'MEETING_ANALYSIS',
          summary: 'Approved sprint goals and architecture direction.',
          decisions: [
            {
              itemId: 'dec-item-1',
              title: 'Adopt vector embeddings',
              decisionText: 'Use 1536 dim embeddings',
              status: 'PROPOSED',
            },
          ],
          requirements: [
            {
              itemId: 'req-item-1',
              title: 'Vector Search Pipeline',
              description: 'Implement hybrid search pipeline',
              priority: Priority.HIGH,
            },
          ],
          actionItems: [
            {
              itemId: 'action-item-1',
              title: 'Deploy pgvector extension in staging',
              description: 'Run migration and verify extension',
              priority: Priority.URGENT,
              dueDate: '2026-09-30',
            },
          ],
        },
        version: 1,
        status: ProposalStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        confirmedBy: null,
        confirmedAt: null,
        resultRecordIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AIProposal;

      let capturedMeetingTask: Task | null = null;
      let capturedMeetingDecision: Decision | null = null;
      let capturedMeetingReq: Requirement | null = null;

      mockDataSource.transaction = jest.fn(
        async (
          cb: (manager: {
            findOne: (entityClass: unknown) => Promise<unknown>;
            query: () => Promise<unknown>;
            create: (entityClass: unknown, plainObject: unknown) => unknown;
            save: (entityClass: unknown, plainObject: unknown) => Promise<unknown>;
            createQueryBuilder: () => unknown;
          }) => Promise<unknown>,
        ) => {
          const mockManager = {
            findOne: jest.fn((entityClass: unknown) => {
              if (entityClass === AIProposal) return Promise.resolve(meetingProposal);
              if (entityClass === Meeting) return Promise.resolve(mockMeeting);
              return Promise.resolve(null);
            }),
            query: jest.fn().mockResolvedValue([{ max: 1 }]),
            create: jest.fn((_entityClass: unknown, plainObject: unknown) => ({
              id: 'gen-meeting-record-id',
              ...(plainObject as object),
            })),
            save: jest.fn((entityClass: unknown, plainObject: unknown) => {
              if (entityClass === Task) capturedMeetingTask = plainObject as Task;
              if (entityClass === Requirement) capturedMeetingReq = plainObject as Requirement;
              if (entityClass === Decision) {
                capturedMeetingDecision = plainObject as Decision;
              }
              return Promise.resolve({ id: 'saved-id', ...(plainObject as object) });
            }),
            createQueryBuilder: jest.fn(() => ({
              innerJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
            })),
          };
          return cb(mockManager);
        },
      );

      const res = await service.confirmProposal(
        mockProjectId,
        mockActor,
        'prop-meeting-123',
        { version: 1, includeSummary: true },
        'key-meeting-confirm',
      );

      expect(res.resultRecordIds.some((r) => r.entityType === 'TASK')).toBe(true);
      expect(res.resultRecordIds.some((r) => r.entityType === 'REQUIREMENT')).toBe(true);
      expect(res.resultRecordIds.some((r) => r.entityType === 'DECISION')).toBe(true);
      expect(res.resultRecordIds.some((r) => r.entityType === 'MEETING_SUMMARY')).toBe(true);

      // Verify source linkage
      expect(capturedMeetingTask).not.toBeNull();
      expect(capturedMeetingTask!.sourceMeetingId).toBe(mockMeeting.id);
      expect(capturedMeetingTask!.requirementId).toBeNull();

      expect(capturedMeetingReq).not.toBeNull();
      expect(capturedMeetingReq!.sourceMeetingId).toBe(mockMeeting.id);

      expect(capturedMeetingDecision).not.toBeNull();
      expect(capturedMeetingDecision!.sourceMeetingId).toBe(mockMeeting.id);
    });

    it('should reject meeting analysis confirmation if meeting transcriptVersion was updated', async () => {
      const meetingProposal = {
        id: 'prop-stale-meeting',
        projectId: mockProjectId,
        userId: mockUserId,
        proposalType: ProposalType.MEETING_ANALYSIS,
        sourceEntityType: 'MEETING',
        sourceEntityId: mockMeeting.id,
        sourceRevision: 3, // based on transcriptVersion 3
        status: ProposalStatus.PENDING,
        version: 1,
        expiresAt: new Date(Date.now() + 100000),
        draftJson: {
          type: 'MEETING_ANALYSIS',
          summary: 'Summary',
          decisions: [],
          requirements: [],
          actionItems: [{ itemId: 'item-1', title: 'Task 1', priority: Priority.MEDIUM }],
        },
      } as unknown as AIProposal;

      mockDataSource.transaction = jest.fn(
        async (
          cb: (manager: {
            findOne: (entityClass: unknown) => Promise<unknown>;
          }) => Promise<unknown>,
        ) => {
          const mockManager = {
            findOne: jest.fn((entityClass: unknown) => {
              if (entityClass === AIProposal) return Promise.resolve(meetingProposal);
              if (entityClass === Meeting)
                return Promise.resolve({ ...mockMeeting, transcriptVersion: 4 }); // drifted!
              return Promise.resolve(null);
            }),
          };
          return cb(mockManager);
        },
      );

      await expect(
        service.confirmProposal(
          mockProjectId,
          mockActor,
          'prop-stale-meeting',
          { version: 1 },
          'key-stale-meeting',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should confirm edited draft tasks with modified title, priority, and selected items', async () => {
      // Step 1: Draft proposal exists with version 2 after being edited
      const editedProposal = {
        id: 'prop-edited-123',
        projectId: mockProjectId,
        userId: mockUserId,
        proposalType: ProposalType.TASK_PROPOSAL,
        sourceEntityType: 'REQUIREMENT',
        sourceEntityId: mockRequirement.id,
        sourceRevision: 2,
        draftJson: {
          type: 'CREATE_TASKS',
          items: [
            {
              itemId: 'edited-item-1',
              title: 'Refined Task Title: Custom Stream Parser',
              description: 'Refined task description with edge-case handling',
              priority: Priority.URGENT,
              dueDate: '2026-10-15',
              sourceIds: [mockRequirement.id],
            },
            {
              itemId: 'edited-item-2',
              title: 'Unselected Task',
              description: 'Will not be confirmed',
              priority: Priority.LOW,
              sourceIds: [],
            },
          ],
        },
        version: 2, // version was bumped after edit
        status: ProposalStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        confirmedBy: null,
        confirmedAt: null,
        resultRecordIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AIProposal;

      let capturedTask: Task | null = null;

      mockDataSource.transaction = jest.fn(
        async (
          cb: (manager: {
            findOne: (entityClass: unknown) => Promise<unknown>;
            query: () => Promise<unknown>;
            create: (entityClass: unknown, plainObject: unknown) => unknown;
            save: (entityClass: unknown, plainObject: unknown) => Promise<unknown>;
          }) => Promise<unknown>,
        ) => {
          const mockManager = {
            findOne: jest.fn((entityClass: unknown) => {
              if (entityClass === AIProposal) return Promise.resolve(editedProposal);
              if (entityClass === Requirement) return Promise.resolve(mockRequirement);
              return Promise.resolve(null);
            }),
            query: jest.fn().mockResolvedValue([{ max: 10 }]),
            create: jest.fn((_entityClass: unknown, plainObject: unknown) => ({
              id: 'gen-task-id',
              ...(plainObject as object),
            })),
            save: jest.fn((entityClass: unknown, plainObject: unknown) => {
              if (entityClass === Task) capturedTask = plainObject as Task;
              return Promise.resolve({ id: 'saved-id', ...(plainObject as object) });
            }),
          };
          return cb(mockManager);
        },
      );

      // Confirm only 'edited-item-1' with version 2
      const res = await service.confirmProposal(
        mockProjectId,
        mockActor,
        'prop-edited-123',
        { version: 2, selectedItemIds: ['edited-item-1'] },
        'key-edited-confirm',
      );

      // Verify only 1 task created, matching edited fields
      expect(res.resultRecordIds).toHaveLength(1);
      expect(capturedTask).not.toBeNull();
      expect(capturedTask!.title).toBe('Refined Task Title: Custom Stream Parser');
      expect(capturedTask!.description).toBe('Refined task description with edge-case handling');
      expect(capturedTask!.priority).toBe(Priority.URGENT);
      expect(capturedTask!.dueDate).toBe('2026-10-15');
      expect(capturedTask!.requirementId).toBe(mockRequirement.id);
      expect(capturedTask!.sourceMeetingId).toBeNull();
    });
  });
});
