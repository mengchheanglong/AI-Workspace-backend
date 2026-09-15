import { NotFoundException } from '@nestjs/common';
import { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import { ProjectStatus } from '../../src/modules/projects/entities/project.entity';
import { TaskStatus } from '../../src/modules/tasks/entities/task.entity';
import { RequirementStatus } from '../../src/modules/requirements/entities/requirement.entity';

describe('DashboardService (Unit)', () => {
  let service: DashboardService;
  let mockProjectRepo: { findOneBy: jest.Mock };
  let mockTaskRepo: { find: jest.Mock };
  let mockReqRepo: { find: jest.Mock };
  let mockAuditRepo: { find: jest.Mock; findAndCount: jest.Mock };

  const mockProjectId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-1';

  beforeEach(() => {
    mockProjectRepo = {
      findOneBy: jest.fn(),
    };
    mockTaskRepo = {
      find: jest.fn(),
    };
    mockReqRepo = {
      find: jest.fn(),
    };
    mockAuditRepo = {
      find: jest.fn(),
      findAndCount: jest.fn(),
    };

    service = new DashboardService(
      mockProjectRepo as unknown as import('typeorm').Repository<
        import('../../src/modules/projects/entities/project.entity').Project
      >,
      mockTaskRepo as unknown as import('typeorm').Repository<
        import('../../src/modules/tasks/entities/task.entity').Task
      >,
      mockReqRepo as unknown as import('typeorm').Repository<
        import('../../src/modules/requirements/entities/requirement.entity').Requirement
      >,
      mockAuditRepo as unknown as import('typeorm').Repository<
        import('../../src/modules/audit/entities/audit-log.entity').AuditLog
      >,
    );
  });

  describe('getDashboard', () => {
    it('throws NotFoundException when project is not found', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue(null);

      await expect(service.getDashboard(mockProjectId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('calculates task progress, status counts, overdue, and assigned metrics correctly', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue({
        id: mockProjectId,
        key: 'AIW',
        name: 'Alpha Workspace',
        description: 'Demo project',
        status: ProjectStatus.ACTIVE,
      });

      mockTaskRepo.find.mockResolvedValue([
        { id: 't1', status: TaskStatus.DONE, dueDate: '2020-01-01', assigneeId: mockUserId },
        { id: 't2', status: TaskStatus.DONE, dueDate: '2099-01-01', assigneeId: 'user-2' },
        { id: 't3', status: TaskStatus.TODO, dueDate: '2020-01-01', assigneeId: mockUserId }, // overdue & assigned
        { id: 't4', status: TaskStatus.IN_PROGRESS, dueDate: '2099-01-01', assigneeId: mockUserId }, // assigned
        { id: 't5', status: TaskStatus.CANCELLED, dueDate: '2020-01-01', assigneeId: mockUserId }, // cancelled excluded from total & overdue
      ]);

      mockReqRepo.find.mockResolvedValue([
        { id: 'r1', status: RequirementStatus.APPROVED },
        { id: 'r2', status: RequirementStatus.IN_PROGRESS },
        { id: 'r3', status: RequirementStatus.DRAFT },
      ]);

      mockAuditRepo.find.mockResolvedValue([
        {
          id: 'log-1',
          action: 'CREATE_TASK',
          entityType: 'TASK',
          entityId: 't3',
          actor: { id: mockUserId, displayName: 'Alice', email: 'alice@example.com' },
          metadata: { number: 3 },
          createdAt: new Date('2026-09-15T10:00:00Z'),
        },
      ]);

      const result = await service.getDashboard(mockProjectId, mockUserId, 'Asia/Bangkok');

      expect(result.project).toEqual({
        id: mockProjectId,
        key: 'AIW',
        name: 'Alpha Workspace',
        description: 'Demo project',
        status: ProjectStatus.ACTIVE,
      });

      // Total non-cancelled = 2 (DONE) + 1 (TODO) + 1 (IN_PROGRESS) = 4
      // Done = 2 -> 2/4 = 50%
      expect(result.taskProgress).toEqual({
        done: 2,
        total: 4,
        percentage: 50,
        label: '50%',
      });

      expect(result.taskCountsByStatus).toEqual({
        TODO: 1,
        IN_PROGRESS: 1,
        IN_REVIEW: 0,
        DONE: 2,
        CANCELLED: 1,
      });

      expect(result.overdueTasksCount).toBe(1); // only t3 (t1 and t5 are closed)
      expect(result.myAssignedTasksCount).toBe(2); // t3 and t4 (t1 is done, t5 is cancelled)

      expect(result.requirementCountsByStatus).toEqual({
        DRAFT: 1,
        APPROVED: 1,
        IN_PROGRESS: 1,
        DONE: 0,
        ARCHIVED: 0,
      });

      expect(result.recentActivity).toHaveLength(1);
      expect(result.recentActivity[0]!.actor?.displayName).toBe('Alice');
    });

    it('handles zero tasks gracefully by setting percentage to null and label to "No tasks yet"', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue({
        id: mockProjectId,
        key: 'AIW',
        name: 'Alpha Workspace',
        description: null,
        status: ProjectStatus.ACTIVE,
      });

      mockTaskRepo.find.mockResolvedValue([]);
      mockReqRepo.find.mockResolvedValue([]);
      mockAuditRepo.find.mockResolvedValue([]);

      const result = await service.getDashboard(mockProjectId, mockUserId);

      expect(result.taskProgress).toEqual({
        done: 0,
        total: 0,
        percentage: null,
        label: 'No tasks yet',
      });
      expect(result.overdueTasksCount).toBe(0);
      expect(result.myAssignedTasksCount).toBe(0);
    });
  });

  describe('getActivity', () => {
    it('returns paginated audit logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'CREATE_REQUIREMENT',
          entityType: 'REQUIREMENT',
          entityId: 'r1',
          actor: null,
          metadata: null,
          createdAt: new Date(),
        },
      ];
      mockAuditRepo.findAndCount.mockResolvedValue([mockLogs, 1]);

      const result = await service.getActivity(mockProjectId, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockAuditRepo.findAndCount).toHaveBeenCalledWith({
        where: { projectId: mockProjectId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
        relations: ['actor'],
      });
    });
  });
});
