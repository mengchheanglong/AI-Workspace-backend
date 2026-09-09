import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequirementsService } from '../../src/modules/requirements/requirements.service';
import {
  Requirement,
  RequirementStatus,
  Priority,
} from '../../src/modules/requirements/entities/requirement.entity';
import { RequirementRevision } from '../../src/modules/requirements/entities/requirement-revision.entity';
import { Project } from '../../src/modules/projects/entities/project.entity';
import { ProjectRole } from '../../src/modules/projects/entities/project-member.entity';
import { AuditService } from '../../src/modules/audit/audit.service';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';
const ACTOR_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_USER = '33333333-3333-3333-3333-333333333333';
const REQ_ID = '44444444-4444-4444-4444-444444444444';

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  const now = new Date();
  return {
    id: REQ_ID,
    projectId: PROJECT_ID,
    number: 1,
    title: 'Test requirement',
    description: 'Desc',
    acceptanceCriteria: 'AC',
    status: RequirementStatus.DRAFT,
    priority: Priority.MEDIUM,
    sourceMeetingId: null,
    createdBy: ACTOR_ID,
    updatedBy: ACTOR_ID,
    version: 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Requirement;
}

describe('RequirementsService', () => {
  let service: RequirementsService;

  const mockRequirementRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockRevisionRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockProjectRepo = {
    findOne: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const mockTransactionManager = {
    query: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
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
        RequirementsService,
        { provide: getRepositoryToken(Requirement), useValue: mockRequirementRepo },
        { provide: getRepositoryToken(RequirementRevision), useValue: mockRevisionRepo },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(RequirementsService);
  });

  describe('create', () => {
    it('should allocate project-local number and create requirement with revision', async () => {
      mockTransactionManager.query.mockResolvedValue([{ max: 5 }]);
      const saved = makeRequirement({ number: 6, version: 1 });
      mockTransactionManager.create.mockReturnValueOnce(saved).mockReturnValueOnce({});
      mockTransactionManager.save.mockResolvedValueOnce(saved).mockResolvedValueOnce({});

      const result = await service.create(PROJECT_ID, ACTOR_ID, {
        title: 'Test requirement',
        description: 'Desc',
      });

      expect(result.number).toBe(6);
      expect(mockTransactionManager.save).toHaveBeenCalledTimes(2); // requirement + revision
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REQUIREMENT_CREATED' }),
      );
    });

    it('should start numbering at 1 when no requirements exist', async () => {
      mockTransactionManager.query.mockResolvedValue([{ max: null }]);
      const saved = makeRequirement({ number: 1 });
      mockTransactionManager.create.mockReturnValueOnce(saved).mockReturnValueOnce({});
      mockTransactionManager.save.mockResolvedValueOnce(saved).mockResolvedValueOnce({});

      const result = await service.create(PROJECT_ID, ACTOR_ID, { title: 'First req' });
      expect(result.number).toBe(1);
    });
  });

  describe('getById', () => {
    it('should return requirement when found', async () => {
      const req = makeRequirement();
      mockRequirementRepo.findOne.mockResolvedValue(req);

      const result = await service.getById(PROJECT_ID, REQ_ID);
      expect(result.id).toBe(REQ_ID);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRequirementRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(PROJECT_ID, REQ_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should create revision and apply updates', async () => {
      const req = makeRequirement({ version: 2 });
      mockRequirementRepo.findOne.mockResolvedValue(req);
      mockRevisionRepo.create.mockReturnValue({});
      mockRevisionRepo.save.mockResolvedValue({});
      mockRequirementRepo.save.mockImplementation(async (entity: Requirement) => ({
        ...entity,
        version: entity.version + 1,
      }));

      const result = await service.update(PROJECT_ID, REQ_ID, ACTOR_ID, {
        version: 2,
        title: 'Updated',
        status: RequirementStatus.APPROVED,
      });

      expect(result.title).toBe('Updated');
      expect(result.status).toBe(RequirementStatus.APPROVED);
      expect(mockRevisionRepo.save).toHaveBeenCalledTimes(1);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REQUIREMENT_UPDATED' }),
      );
    });

    it('should throw ConflictException on version mismatch', async () => {
      const req = makeRequirement({ version: 3 });
      mockRequirementRepo.findOne.mockResolvedValue(req);

      await expect(
        service.update(PROJECT_ID, REQ_ID, ACTOR_ID, { version: 2, title: 'New' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('softDelete', () => {
    it('should allow Owner to delete any requirement', async () => {
      const req = makeRequirement({ createdBy: OTHER_USER });
      mockRequirementRepo.findOne.mockResolvedValue(req);
      mockRequirementRepo.save.mockResolvedValue(req);

      await service.softDelete(PROJECT_ID, REQ_ID, ACTOR_ID, ProjectRole.OWNER);

      expect(req.deletedAt).not.toBeNull();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REQUIREMENT_DELETED' }),
      );
    });

    it('should allow Contributor to delete own requirement', async () => {
      const req = makeRequirement({ createdBy: ACTOR_ID });
      mockRequirementRepo.findOne.mockResolvedValue(req);
      mockRequirementRepo.save.mockResolvedValue(req);

      await service.softDelete(PROJECT_ID, REQ_ID, ACTOR_ID, ProjectRole.CONTRIBUTOR);

      expect(req.deletedAt).not.toBeNull();
    });

    it('should forbid Contributor from deleting others requirement', async () => {
      const req = makeRequirement({ createdBy: OTHER_USER });
      mockRequirementRepo.findOne.mockResolvedValue(req);

      await expect(
        service.softDelete(PROJECT_ID, REQ_ID, ACTOR_ID, ProjectRole.CONTRIBUTOR),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listRevisions', () => {
    it('should return revisions for a valid requirement', async () => {
      const req = makeRequirement();
      mockRequirementRepo.findOne.mockResolvedValue(req);
      const revisions = [{ id: 'rev1', version: 1 }];
      mockRevisionRepo.find.mockResolvedValue(revisions);

      const result = await service.listRevisions(PROJECT_ID, REQ_ID);
      expect(result).toEqual(revisions);
    });
  });

  describe('getProjectKey', () => {
    it('should return project key', async () => {
      mockProjectRepo.findOne.mockResolvedValue({ key: 'AIW' });
      const key = await service.getProjectKey(PROJECT_ID);
      expect(key).toBe('AIW');
    });

    it('should throw NotFoundException if project missing', async () => {
      mockProjectRepo.findOne.mockResolvedValue(null);
      await expect(service.getProjectKey(PROJECT_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
