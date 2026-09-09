import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { ProjectPolicyGuard } from '../../src/common/guards/project-policy.guard';
import {
  ProjectMember,
  ProjectRole,
} from '../../src/modules/projects/entities/project-member.entity';
import { Project, ProjectStatus } from '../../src/modules/projects/entities/project.entity';
import { ProfessionalRole, SystemRole, User } from '../../src/modules/users/entities/user.entity';

describe('ProjectPolicyGuard', () => {
  let guard: ProjectPolicyGuard;
  let reflector: jest.Mocked<Reflector>;
  let memberRepo: jest.Mocked<Repository<ProjectMember>>;

  const mockUser: User = {
    id: 'user-1',
    email: 'user@workspace.local',
    displayName: 'User One',
    passwordHash: 'hash',
    systemRole: SystemRole.USER,
    professionalRole: ProfessionalRole.DEVELOPER,
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProject: Project = {
    id: 'proj-1',
    key: 'AIW',
    name: 'AI Workspace',
    description: 'Test project',
    status: ProjectStatus.ACTIVE,
    createdBy: 'user-1',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    memberRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<ProjectMember>>;

    guard = new ProjectPolicyGuard(reflector, memberRepo);
  });

  function createMockContext(
    method: string,
    params: Record<string, string | string[]>,
    user?: User,
  ): ExecutionContext {
    const req = {
      method,
      params,
      user,
    } as unknown as Request;
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('skips project checks when route does not have a projectId parameter', async () => {
    const ctx = createMockContext('GET', {}, mockUser);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('throws 404 NotFound when user has no active membership in project to prevent enumeration', async () => {
    memberRepo.findOne.mockResolvedValue(null);
    const ctx = createMockContext('GET', { projectId: 'proj-1' }, mockUser);

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('throws 400 BadRequest when mutating an archived project unless allowed', async () => {
    const archivedProject = { ...mockProject, status: ProjectStatus.ARCHIVED };
    const membership: ProjectMember = {
      id: 'mem-1',
      projectId: 'proj-1',
      project: archivedProject,
      userId: 'user-1',
      user: mockUser,
      accessRole: ProjectRole.OWNER,
      joinedAt: new Date(),
      removedAt: null,
    };

    memberRepo.findOne.mockResolvedValue(membership);
    reflector.getAllAndOverride.mockReturnValue(false); // allowArchived = false

    const ctx = createMockContext('PATCH', { projectId: 'proj-1' }, mockUser);
    await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
  });

  it('allows unarchiving mutation on archived project when @AllowArchived is set', async () => {
    const archivedProject = { ...mockProject, status: ProjectStatus.ARCHIVED };
    const membership: ProjectMember = {
      id: 'mem-1',
      projectId: 'proj-1',
      project: archivedProject,
      userId: 'user-1',
      user: mockUser,
      accessRole: ProjectRole.OWNER,
      joinedAt: new Date(),
      removedAt: null,
    };

    memberRepo.findOne.mockResolvedValue(membership);
    reflector.getAllAndOverride
      .mockReturnValueOnce(true) // allowArchived
      .mockReturnValueOnce([ProjectRole.OWNER]); // requiredRoles

    const ctx = createMockContext('POST', { projectId: 'proj-1' }, mockUser);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('throws 403 Forbidden when member does not possess required role', async () => {
    const membership: ProjectMember = {
      id: 'mem-1',
      projectId: 'proj-1',
      project: mockProject,
      userId: 'user-1',
      user: mockUser,
      accessRole: ProjectRole.VIEWER,
      joinedAt: new Date(),
      removedAt: null,
    };

    memberRepo.findOne.mockResolvedValue(membership);
    reflector.getAllAndOverride.mockReturnValue([ProjectRole.OWNER, ProjectRole.MANAGER]);

    const ctx = createMockContext('PATCH', { projectId: 'proj-1' }, mockUser);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows access and attaches project and membership context when authorized', async () => {
    const membership: ProjectMember = {
      id: 'mem-1',
      projectId: 'proj-1',
      project: mockProject,
      userId: 'user-1',
      user: mockUser,
      accessRole: ProjectRole.OWNER,
      joinedAt: new Date(),
      removedAt: null,
    };

    memberRepo.findOne.mockResolvedValue(membership);
    reflector.getAllAndOverride.mockReturnValue([ProjectRole.OWNER, ProjectRole.MANAGER]);

    const ctx = createMockContext('GET', { projectId: 'proj-1' }, mockUser);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    const req = ctx.switchToHttp().getRequest<Request>();
    expect(req.project?.id).toBe('proj-1');
    expect(req.membership?.accessRole).toBe(ProjectRole.OWNER);
  });
});
