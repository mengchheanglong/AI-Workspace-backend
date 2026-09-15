import 'reflect-metadata';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, FindManyOptions } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { configureApp } from '../../src/common/configure-app';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { UsersModule } from '../../src/modules/users/users.module';
import { ProjectsModule } from '../../src/modules/projects/projects.module';
import { RequirementsModule } from '../../src/modules/requirements/requirements.module';
import { DecisionsModule } from '../../src/modules/decisions/decisions.module';
import { TasksModule } from '../../src/modules/tasks/tasks.module';
import { MeetingsModule } from '../../src/modules/meetings/meetings.module';
import { DocumentsModule } from '../../src/modules/documents/documents.module';
import { DashboardModule } from '../../src/modules/dashboard/dashboard.module';
import { SearchModule } from '../../src/modules/search/search.module';
import { AuditModule } from '../../src/modules/audit/audit.module';
import { User, SystemRole, ProfessionalRole } from '../../src/modules/users/entities/user.entity';
import { Session } from '../../src/modules/auth/entities/session.entity';
import { Project, ProjectStatus } from '../../src/modules/projects/entities/project.entity';
import {
  ProjectMember,
  ProjectRole,
} from '../../src/modules/projects/entities/project-member.entity';
import { AuditLog } from '../../src/modules/audit/entities/audit-log.entity';
import {
  Requirement,
  RequirementStatus,
  Priority,
} from '../../src/modules/requirements/entities/requirement.entity';
import { RequirementRevision } from '../../src/modules/requirements/entities/requirement-revision.entity';
import { Decision, DecisionStatus } from '../../src/modules/decisions/entities/decision.entity';
import { DecisionRevision } from '../../src/modules/decisions/entities/decision-revision.entity';
import { Task, TaskStatus } from '../../src/modules/tasks/entities/task.entity';
import { Meeting } from '../../src/modules/meetings/entities/meeting.entity';
import { MeetingAttendee } from '../../src/modules/meetings/entities/meeting-attendee.entity';
import { Document, ProcessingStatus } from '../../src/modules/documents/entities/document.entity';
import { DocumentRevision } from '../../src/modules/documents/entities/document-revision.entity';
import { STORAGE_DRIVER } from '../../src/modules/storage/storage.interface';
import { PasswordService } from '../../src/modules/auth/services/password.service';

describe('Workspace Integration API - Dashboard & Search (E2E)', () => {
  let app: INestApplication;
  let passwordService: PasswordService;

  const users: User[] = [];
  const sessions: Session[] = [];
  const projects: Project[] = [];
  const projectMembers: ProjectMember[] = [];
  const auditLogs: AuditLog[] = [];
  const requirements: Requirement[] = [];
  const decisions: Decision[] = [];
  const tasks: Task[] = [];
  const meetings: Meeting[] = [];
  const meetingAttendees: MeetingAttendee[] = [];
  const documents: Document[] = [];

  // ── Mock repositories ─────────────────────────────────────────────

  const mockUserRepository = {
    create: jest.fn(
      (dto: Partial<User>) =>
        ({
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          mustChangePassword: false,
          ...dto,
        }) as User,
    ),
    save: jest.fn(async (user: User) => {
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx >= 0) users[idx] = user;
      else users.push(user);
      return user;
    }),
    findOne: jest.fn(async (opts: { where: { email?: string; id?: string } }) => {
      if (opts.where.email)
        return users.find((u) => u.email.toLowerCase() === opts.where.email?.toLowerCase()) ?? null;
      if (opts.where.id) return users.find((u) => u.id === opts.where.id) ?? null;
      return null;
    }),
    find: jest.fn(async () => users),
    findAndCount: jest.fn(async () => [users, users.length]),
    count: jest.fn(async () => users.length),
  };

  const mockSessionRepository = {
    create: jest.fn(
      (dto: Partial<Session>) =>
        ({
          id: randomUUID(),
          createdAt: new Date(),
          ...dto,
        }) as Session,
    ),
    save: jest.fn(async (session: Session) => {
      const idx = sessions.findIndex((s) => s.id === session.id);
      if (idx >= 0) sessions[idx] = session;
      else sessions.push(session);
      return session;
    }),
    findOne: jest.fn(async (opts: { where: { tokenHash?: string } }) => {
      if (opts.where.tokenHash) {
        const found = sessions.find((s) => s.tokenHash === opts.where.tokenHash);
        if (found) {
          const user = users.find((u) => u.id === found.userId);
          return { ...found, user };
        }
      }
      return null;
    }),
  };

  const mockProjectRepository = {
    create: jest.fn(
      (dto: Partial<Project>) =>
        ({
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          status: ProjectStatus.ACTIVE,
          version: 1,
          ...dto,
        }) as Project,
    ),
    save: jest.fn(async (project: Project) => {
      const idx = projects.findIndex((p) => p.id === project.id);
      if (idx >= 0) projects[idx] = project;
      else projects.push(project);
      return project;
    }),
    findOne: jest.fn(async (opts: { where: { id?: string; key?: string } }) => {
      if (opts.where.id) return projects.find((p) => p.id === opts.where.id) ?? null;
      if (opts.where.key) return projects.find((p) => p.key === opts.where.key) ?? null;
      return null;
    }),
    findOneBy: jest.fn(async (where: { id?: string; key?: string }) => {
      if (where.id) return projects.find((p) => p.id === where.id) ?? null;
      if (where.key) return projects.find((p) => p.key === where.key) ?? null;
      return null;
    }),
    find: jest.fn(async () => projects),
  };

  const mockProjectMemberRepository = {
    create: jest.fn(
      (dto: Partial<ProjectMember>) =>
        ({
          id: randomUUID(),
          joinedAt: new Date(),
          removedAt: null,
          ...dto,
        }) as ProjectMember,
    ),
    save: jest.fn(async (member: ProjectMember) => {
      const idx = projectMembers.findIndex((m) => m.id === member.id);
      if (idx >= 0) projectMembers[idx] = member;
      else projectMembers.push(member);
      return member;
    }),
    findOne: jest.fn(
      async (opts: { where: { projectId?: string; userId?: string; accessRole?: string } }) => {
        return (
          projectMembers.find((m) => {
            const matchProject = !opts.where.projectId || m.projectId === opts.where.projectId;
            const matchUser = !opts.where.userId || m.userId === opts.where.userId;
            const matchRole = !opts.where.accessRole || m.accessRole === opts.where.accessRole;
            const matchActive = !m.removedAt;
            return matchProject && matchUser && matchRole && matchActive;
          }) ?? null
        );
      },
    ),
    find: jest.fn(async (opts?: { where: { projectId?: string; userId?: string } }) => {
      return projectMembers.filter((m) => {
        const matchProject = !opts?.where?.projectId || m.projectId === opts.where.projectId;
        const matchUser = !opts?.where?.userId || m.userId === opts.where.userId;
        return matchProject && matchUser && !m.removedAt;
      });
    }),
  };

  const mockAuditLogRepository = {
    create: jest.fn(
      (dto: Partial<AuditLog>) =>
        ({
          id: randomUUID(),
          createdAt: new Date(),
          ...dto,
        }) as AuditLog,
    ),
    save: jest.fn(async (log: AuditLog) => {
      auditLogs.push(log);
      return log;
    }),
    find: jest.fn(async (opts?: FindManyOptions<AuditLog>) => {
      const where = opts?.where as { projectId?: string };
      let filtered = auditLogs.filter((l) => !where?.projectId || l.projectId === where.projectId);
      filtered = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (opts?.take) filtered = filtered.slice(0, opts.take);
      return filtered.map((l) => ({
        ...l,
        actor: users.find((u) => u.id === l.actorId) ?? null,
      }));
    }),
    findAndCount: jest.fn(async (opts?: FindManyOptions<AuditLog>) => {
      const where = opts?.where as { projectId?: string };
      let filtered = auditLogs.filter((l) => !where?.projectId || l.projectId === where.projectId);
      filtered = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const total = filtered.length;
      const skip = opts?.skip ?? 0;
      const take = opts?.take ?? 20;
      const data = filtered.slice(skip, skip + take).map((l) => ({
        ...l,
        actor: users.find((u) => u.id === l.actorId) ?? null,
      }));
      return [data, total];
    }),
  };

  interface MockE2EQueryBuilder<T> {
    leftJoinAndSelect: (relation: string, alias: string) => MockE2EQueryBuilder<T>;
    where: (clause: string, params?: Record<string, unknown>) => MockE2EQueryBuilder<T>;
    andWhere: (clause: string, params?: Record<string, unknown>) => MockE2EQueryBuilder<T>;
    getMany: () => Promise<T[]>;
  }

  const mockTaskRepository = {
    find: jest.fn(async (opts?: FindManyOptions<Task>) => {
      const where = opts?.where as { projectId?: string };
      return tasks.filter(
        (t) => (!where?.projectId || t.projectId === where.projectId) && !t.deletedAt,
      );
    }),
    createQueryBuilder: jest.fn(() => {
      let filterStatus: string | undefined;
      let filterAssigneeId: string | undefined;
      const builder: MockE2EQueryBuilder<Task> = {
        leftJoinAndSelect: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn((_clause: string, params?: Record<string, unknown>) => {
          if (params?.status) filterStatus = String(params.status);
          if (params?.assigneeId) filterAssigneeId = String(params.assigneeId);
          return builder;
        }),
        getMany: jest.fn(async () => {
          return tasks
            .filter((t) => !t.deletedAt)
            .filter((t) => !filterStatus || t.status === filterStatus)
            .filter((t) => !filterAssigneeId || t.assigneeId === filterAssigneeId)
            .map((t) => ({
              ...t,
              assignee: users.find((u) => u.id === t.assigneeId) ?? null,
            }));
        }),
      };
      return builder;
    }),
  };

  const mockRequirementRepository = {
    find: jest.fn(async (opts?: FindManyOptions<Requirement>) => {
      const where = opts?.where as { projectId?: string };
      return requirements.filter(
        (r) => (!where?.projectId || r.projectId === where.projectId) && !r.deletedAt,
      );
    }),
    createQueryBuilder: jest.fn(() => {
      let filterStatus: string | undefined;
      const builder: MockE2EQueryBuilder<Requirement> = {
        leftJoinAndSelect: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn((_clause: string, params?: Record<string, unknown>) => {
          if (params?.status) filterStatus = String(params.status);
          return builder;
        }),
        getMany: jest.fn(async () => {
          return requirements
            .filter((r) => !r.deletedAt)
            .filter((r) => !filterStatus || r.status === filterStatus);
        }),
      };
      return builder;
    }),
  };

  const mockDecisionRepository = {
    createQueryBuilder: jest.fn(() => {
      let filterStatus: string | undefined;
      const builder: MockE2EQueryBuilder<Decision> = {
        leftJoinAndSelect: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn((_clause: string, params?: Record<string, unknown>) => {
          if (params?.status) filterStatus = String(params.status);
          return builder;
        }),
        getMany: jest.fn(async () => {
          return decisions
            .filter((d) => !d.deletedAt)
            .filter((d) => !filterStatus || d.status === filterStatus);
        }),
      };
      return builder;
    }),
  };

  const mockMeetingRepository = {
    createQueryBuilder: jest.fn(() => {
      const builder: MockE2EQueryBuilder<Meeting> = {
        leftJoinAndSelect: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn(() => builder),
        getMany: jest.fn(async () => meetings.filter((m) => !m.deletedAt)),
      };
      return builder;
    }),
  };

  const mockDocumentRepository = {
    createQueryBuilder: jest.fn(() => {
      let filterStatus: string | undefined;
      const builder: MockE2EQueryBuilder<Document> = {
        leftJoinAndSelect: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn((_clause: string, params?: Record<string, unknown>) => {
          if (params?.status) filterStatus = String(params.status);
          return builder;
        }),
        getMany: jest.fn(async () => {
          return documents
            .filter((d) => !d.deletedAt)
            .filter((d) => !filterStatus || d.processingStatus === filterStatus);
        }),
      };
      return builder;
    }),
  };

  const mockStorageDriver = {
    putObject: jest.fn().mockResolvedValue(undefined),
    getObjectStream: jest.fn(),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
  };

  const mockDataSource = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === User) return mockUserRepository;
      if (entity === Session) return mockSessionRepository;
      if (entity === Project) return mockProjectRepository;
      if (entity === ProjectMember) return mockProjectMemberRepository;
      if (entity === AuditLog) return mockAuditLogRepository;
      if (entity === Task) return mockTaskRepository;
      if (entity === Requirement) return mockRequirementRepository;
      if (entity === Decision) return mockDecisionRepository;
      if (entity === Meeting) return mockMeetingRepository;
      if (entity === Document) return mockDocumentRepository;
      return {};
    }),
  };

  @Global()
  @Module({
    providers: [
      {
        provide: ConfigService,
        useValue: new ConfigService({
          NODE_ENV: 'test',
          PORT: 3000,
          APP_ORIGIN: 'http://localhost:3000',
          SESSION_IDLE_HOURS: 8,
          SESSION_ABSOLUTE_DAYS: 7,
          LOG_LEVEL: 'silent',
          STORAGE_LOCAL_ROOT: './var/uploads-test',
          MAX_UPLOAD_BYTES: 20971520,
        }),
      },
      { provide: DataSource, useValue: mockDataSource },
      { provide: STORAGE_DRIVER, useValue: mockStorageDriver },
    ],
    exports: [ConfigService, DataSource, STORAGE_DRIVER],
  })
  class TestDatabaseModule {}

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TestDatabaseModule,
        AuthModule,
        UsersModule,
        ProjectsModule,
        RequirementsModule,
        DecisionsModule,
        TasksModule,
        MeetingsModule,
        DocumentsModule,
        DashboardModule,
        SearchModule,
        AuditModule,
      ],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(mockUserRepository)
      .overrideProvider(getRepositoryToken(Session))
      .useValue(mockSessionRepository)
      .overrideProvider(getRepositoryToken(Project))
      .useValue(mockProjectRepository)
      .overrideProvider(getRepositoryToken(ProjectMember))
      .useValue(mockProjectMemberRepository)
      .overrideProvider(getRepositoryToken(AuditLog))
      .useValue(mockAuditLogRepository)
      .overrideProvider(getRepositoryToken(Requirement))
      .useValue(mockRequirementRepository)
      .overrideProvider(getRepositoryToken(RequirementRevision))
      .useValue({ save: jest.fn(), find: jest.fn() })
      .overrideProvider(getRepositoryToken(Decision))
      .useValue(mockDecisionRepository)
      .overrideProvider(getRepositoryToken(DecisionRevision))
      .useValue({ save: jest.fn(), find: jest.fn() })
      .overrideProvider(getRepositoryToken(Task))
      .useValue(mockTaskRepository)
      .overrideProvider(getRepositoryToken(Meeting))
      .useValue(mockMeetingRepository)
      .overrideProvider(getRepositoryToken(MeetingAttendee))
      .useValue({ save: jest.fn(), find: jest.fn() })
      .overrideProvider(getRepositoryToken(Document))
      .useValue(mockDocumentRepository)
      .overrideProvider(getRepositoryToken(DocumentRevision))
      .useValue({ save: jest.fn(), find: jest.fn() })
      .overrideProvider(STORAGE_DRIVER)
      .useValue(mockStorageDriver)
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();

    passwordService = moduleRef.get(PasswordService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ── Test Setup Helpers ────────────────────────────────────────────

  let ownerUser: User;
  let nonMemberUser: User;
  let ownerCookie: string;
  let nonMemberCookie: string;

  let project1: Project;
  let project2: Project;

  beforeEach(async () => {
    users.length = 0;
    sessions.length = 0;
    projects.length = 0;
    projectMembers.length = 0;
    auditLogs.length = 0;
    requirements.length = 0;
    decisions.length = 0;
    tasks.length = 0;
    meetings.length = 0;
    meetingAttendees.length = 0;
    documents.length = 0;

    const hashedPassword = await passwordService.hash('Password123!');

    ownerUser = {
      id: randomUUID(),
      email: 'owner@example.com',
      displayName: 'Alice Owner',
      passwordHash: hashedPassword,
      systemRole: SystemRole.USER,
      professionalRole: ProfessionalRole.PM,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(ownerUser);

    nonMemberUser = {
      id: randomUUID(),
      email: 'outsider@example.com',
      displayName: 'Bob Outsider',
      passwordHash: hashedPassword,
      systemRole: SystemRole.USER,
      professionalRole: ProfessionalRole.DEVELOPER,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(nonMemberUser);

    // Login owner
    const loginRes1 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'Password123!' });

    ownerCookie = loginRes1.headers['set-cookie']?.[0] ?? '';

    // Login outsider
    const loginRes2 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'outsider@example.com', password: 'Password123!' });

    nonMemberCookie = loginRes2.headers['set-cookie']?.[0] ?? '';

    // Create Project 1 (Owner: Alice)
    project1 = {
      id: randomUUID(),
      key: 'AIW',
      name: 'Alpha Workspace',
      description: 'Alpha workspace description',
      status: ProjectStatus.ACTIVE,
      createdBy: ownerUser.id,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    projects.push(project1);

    projectMembers.push({
      id: randomUUID(),
      projectId: project1.id,
      userId: ownerUser.id,
      accessRole: ProjectRole.OWNER,
      project: project1,
      user: ownerUser,
      joinedAt: new Date(),
      removedAt: null,
    });

    // Create Project 2 (Owner: Bob)
    project2 = {
      id: randomUUID(),
      key: 'SEC',
      name: 'Beta Security Workspace',
      description: 'Security workspace',
      status: ProjectStatus.ACTIVE,
      createdBy: nonMemberUser.id,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    projects.push(project2);

    projectMembers.push({
      id: randomUUID(),
      projectId: project2.id,
      userId: nonMemberUser.id,
      accessRole: ProjectRole.OWNER,
      project: project2,
      user: nonMemberUser,
      joinedAt: new Date(),
      removedAt: null,
    });

    // Seed data in Project 1
    // Requirements
    requirements.push(
      {
        id: randomUUID(),
        projectId: project1.id,
        number: 1,
        title: 'Authentication Module',
        description: 'Session cookie handling',
        acceptanceCriteria: 'Works on modern browsers',
        status: RequirementStatus.APPROVED,
        priority: Priority.HIGH,
        sourceMeetingId: null,
        createdBy: ownerUser.id,
        updatedBy: ownerUser.id,
        version: 1,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date('2026-09-15T12:00:00Z'),
      },
      {
        id: randomUUID(),
        projectId: project1.id,
        number: 2,
        title: 'Document Upload',
        description: 'PDF uploads',
        acceptanceCriteria: '20MB limit',
        status: RequirementStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        sourceMeetingId: null,
        createdBy: ownerUser.id,
        updatedBy: ownerUser.id,
        version: 1,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date('2026-09-15T11:00:00Z'),
      },
    );

    // Decisions
    decisions.push({
      id: randomUUID(),
      projectId: project1.id,
      number: 1,
      title: 'Adopt NestJS Architecture',
      decisionText: 'Modular monolith',
      rationale: 'TypeScript ecosystem',
      status: DecisionStatus.ACCEPTED,
      decidedAt: new Date(),
      decidedBy: ownerUser.id,
      requirementId: null,
      sourceMeetingId: null,
      supersedesDecisionId: null,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
      version: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date('2026-09-15T10:00:00Z'),
    });

    // Tasks: 2 DONE, 1 TODO (overdue & assigned to owner), 1 IN_PROGRESS (assigned to owner), 1 CANCELLED
    tasks.push(
      {
        id: randomUUID(),
        projectId: project1.id,
        number: 1,
        title: 'Configure DB',
        description: 'PostgreSQL setup',
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        assigneeId: ownerUser.id,
        dueDate: null,
        requirementId: null,
        sourceMeetingId: null,
        createdBy: ownerUser.id,
        updatedBy: ownerUser.id,
        version: 1,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date('2026-09-15T14:00:00Z'),
      },
      {
        id: randomUUID(),
        projectId: project1.id,
        number: 2,
        title: 'Setup Migrations',
        description: 'TypeORM migrations',
        status: TaskStatus.DONE,
        priority: Priority.MEDIUM,
        assigneeId: null,
        dueDate: null,
        requirementId: null,
        sourceMeetingId: null,
        createdBy: ownerUser.id,
        updatedBy: ownerUser.id,
        version: 1,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date('2026-09-15T13:00:00Z'),
      },
      {
        id: randomUUID(),
        projectId: project1.id,
        number: 3,
        title: 'Fix overdue bug',
        description: 'Critical fix',
        status: TaskStatus.TODO,
        priority: Priority.URGENT,
        assigneeId: ownerUser.id,
        dueDate: '2020-01-01', // Overdue
        requirementId: null,
        sourceMeetingId: null,
        createdBy: ownerUser.id,
        updatedBy: ownerUser.id,
        version: 1,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date('2026-09-15T15:00:00Z'),
      },
      {
        id: randomUUID(),
        projectId: project1.id,
        number: 4,
        title: 'Implement Search',
        description: 'Keyword search',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        assigneeId: ownerUser.id,
        dueDate: '2099-01-01',
        requirementId: null,
        sourceMeetingId: null,
        createdBy: ownerUser.id,
        updatedBy: ownerUser.id,
        version: 1,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date('2026-09-15T16:00:00Z'),
      },
      {
        id: randomUUID(),
        projectId: project1.id,
        number: 5,
        title: 'Old discarded task',
        description: 'Cancelled task',
        status: TaskStatus.CANCELLED,
        priority: Priority.LOW,
        assigneeId: ownerUser.id,
        dueDate: '2020-01-01',
        requirementId: null,
        sourceMeetingId: null,
        createdBy: ownerUser.id,
        updatedBy: ownerUser.id,
        version: 1,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date('2026-09-15T09:00:00Z'),
      },
    );

    // Meetings
    meetings.push({
      id: randomUUID(),
      projectId: project1.id,
      title: 'Weekly Standup',
      startsAt: new Date('2026-09-15T09:00:00Z'),
      endsAt: new Date('2026-09-15T09:30:00Z'),
      agenda: 'Sync on progress',
      notes: 'Good progress made',
      transcriptText: 'All good',
      transcriptVersion: 1,
      summary: 'Standup completed',
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
      version: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date('2026-09-15T09:30:00Z'),
    });

    // Documents
    documents.push({
      id: randomUUID(),
      projectId: project1.id,
      title: 'Architecture PDF',
      description: 'System diagrams',
      originalFilename: 'arch.pdf',
      storageKey: 'projects/aiw/arch.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      revision: 1,
      processingStatus: ProcessingStatus.COMPLETED,
      lastErrorCode: null,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
      version: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date('2026-09-15T08:00:00Z'),
    });

    // Audit logs
    auditLogs.push(
      {
        id: randomUUID(),
        projectId: project1.id,
        actorId: ownerUser.id,
        action: 'PROJECT_CREATED',
        entityType: 'PROJECT',
        entityId: project1.id,
        metadata: { name: project1.name },
        requestId: null,
        createdAt: new Date('2026-09-15T07:00:00Z'),
      },
      {
        id: randomUUID(),
        projectId: project1.id,
        actorId: ownerUser.id,
        action: 'CREATE_TASK',
        entityType: 'TASK',
        entityId: tasks[2]!.id,
        metadata: { number: 3, title: tasks[2]!.title },
        requestId: null,
        createdAt: new Date('2026-09-15T15:00:00Z'),
      },
    );
  });

  // ── Dashboard Tests ───────────────────────────────────────────────

  describe('GET /projects/:projectId/dashboard', () => {
    it('returns 404 for non-existent project', async () => {
      const nonExistentId = randomUUID();
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${nonExistentId}/dashboard`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('PROJECT_NOT_FOUND');
    });

    it('returns 404 when non-member tries to access project dashboard (access isolation)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project1.id}/dashboard`)
        .set('Cookie', nonMemberCookie);

      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('PROJECT_NOT_FOUND');
    });

    it('returns accurate dashboard aggregates, task progress calculation, and recent activity', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project1.id}/dashboard`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(200);
      const dashboard = res.body.data;

      // Project metadata
      expect(dashboard.project.id).toBe(project1.id);
      expect(dashboard.project.key).toBe('AIW');
      expect(dashboard.project.name).toBe('Alpha Workspace');

      // Task progress formula: 2 DONE / (2 DONE + 1 TODO + 1 IN_PROGRESS = 4 total non-cancelled) = 50%
      expect(dashboard.taskProgress).toEqual({
        done: 2,
        total: 4,
        percentage: 50,
        label: '50%',
      });

      // Status breakdown
      expect(dashboard.taskCountsByStatus).toEqual({
        TODO: 1,
        IN_PROGRESS: 1,
        IN_REVIEW: 0,
        DONE: 2,
        CANCELLED: 1,
      });

      // Overdue tasks: only task 3 (status TODO, dueDate 2020-01-01)
      expect(dashboard.overdueTasksCount).toBe(1);

      // My assigned open tasks: task 3 (TODO) and task 4 (IN_PROGRESS)
      expect(dashboard.myAssignedTasksCount).toBe(2);

      // Requirement counts
      expect(dashboard.requirementCountsByStatus).toEqual({
        DRAFT: 0,
        APPROVED: 1,
        IN_PROGRESS: 1,
        DONE: 0,
        ARCHIVED: 0,
      });

      // Recent activity
      expect(dashboard.recentActivity).toHaveLength(2);
      expect(dashboard.recentActivity[0]!.action).toBe('CREATE_TASK');
      expect(dashboard.recentActivity[0]!.actor?.displayName).toBe('Alice Owner');
    });
  });

  // ── Activity Stream Tests ─────────────────────────────────────────

  describe('GET /projects/:projectId/activity', () => {
    it('returns paginated activity stream for permitted project member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project1.id}/activity?page=1&pageSize=10`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({
        page: 1,
        pageSize: 10,
        total: 2,
      });
      expect(res.body.data[0]!.action).toBe('CREATE_TASK');
    });

    it('returns 404 for non-member user requesting activity', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project1.id}/activity`)
        .set('Cookie', nonMemberCookie);

      expect(res.status).toBe(404);
    });
  });

  // ── Search Tests ──────────────────────────────────────────────────

  describe('GET /projects/:projectId/search', () => {
    it('returns 404 for non-member user searching project knowledge base', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project1.id}/search?q=auth`)
        .set('Cookie', nonMemberCookie);

      expect(res.status).toBe(404);
    });

    it('returns 400 validation error when query parameter q is missing', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project1.id}/search`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(400);
    });

    it('returns unified multi-entity results with project-local keys and countsByType', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project1.id}/search?q=architecture`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(200);
      const results = res.body.data;
      const meta = res.body.meta;

      expect(meta.total).toBe(10);
      expect(meta.countsByType).toEqual({
        REQUIREMENT: 2,
        DECISION: 1,
        TASK: 5,
        MEETING: 1,
        DOCUMENT: 1,
      });

      // Check key formats
      const reqItem = results.find((i: { type: string }) => i.type === 'REQUIREMENT');
      expect(reqItem.key).toMatch(/^AIW-REQ-\d+$/);

      const decItem = results.find((i: { type: string }) => i.type === 'DECISION');
      expect(decItem.key).toMatch(/^AIW-DEC-\d+$/);

      const taskItem = results.find((i: { type: string }) => i.type === 'TASK');
      expect(taskItem.key).toMatch(/^AIW-TSK-\d+$/);
    });

    it('filters search results by entity type when type filter is provided', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project1.id}/search?q=pdf&type=DOCUMENT`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.every((i: { type: string }) => i.type === 'DOCUMENT')).toBe(true);
      expect(res.body.meta.countsByType.DOCUMENT).toBe(1);
      expect(res.body.meta.countsByType.TASK).toBe(0);
    });

    it('filters search results by status when status filter is provided', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project1.id}/search?q=task&type=TASK&status=DONE`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.every((i: { status: string }) => i.status === 'DONE')).toBe(true);
    });
  });
});
