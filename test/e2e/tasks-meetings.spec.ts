import 'reflect-metadata';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, FindManyOptions, FindOneOptions } from 'typeorm';
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
import { AuditModule } from '../../src/modules/audit/audit.module';
import { User, SystemRole, ProfessionalRole } from '../../src/modules/users/entities/user.entity';
import { Session } from '../../src/modules/auth/entities/session.entity';
import { Project, ProjectStatus } from '../../src/modules/projects/entities/project.entity';
import {
  ProjectMember,
  ProjectRole,
} from '../../src/modules/projects/entities/project-member.entity';
import { AuditLog } from '../../src/modules/audit/entities/audit-log.entity';
import { Requirement } from '../../src/modules/requirements/entities/requirement.entity';
import { RequirementRevision } from '../../src/modules/requirements/entities/requirement-revision.entity';
import { Decision } from '../../src/modules/decisions/entities/decision.entity';
import { DecisionRevision } from '../../src/modules/decisions/entities/decision-revision.entity';
import { Task, Priority } from '../../src/modules/tasks/entities/task.entity';
import { Meeting } from '../../src/modules/meetings/entities/meeting.entity';
import { MeetingAttendee } from '../../src/modules/meetings/entities/meeting-attendee.entity';
import { PasswordService } from '../../src/modules/auth/services/password.service';
import { OutboxService } from '../../src/modules/ingestion/outbox.service';

describe('Tasks and Meetings API (E2E)', () => {
  let app: INestApplication;
  let passwordService: PasswordService;

  const users: User[] = [];
  const sessions: Session[] = [];
  const projects: Project[] = [];
  const projectMembers: ProjectMember[] = [];
  const auditLogs: AuditLog[] = [];
  const requirements: Requirement[] = [];
  const tasks: Task[] = [];
  const meetings: Meeting[] = [];
  const meetingAttendees: MeetingAttendee[] = [];

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
    find: jest.fn(async (opts?: { where: { id?: unknown } }) => {
      if (opts?.where?.id) {
        const idCondition = opts.where.id as { _value?: string[] };
        const ids = idCondition._value ?? [];
        return users.filter((u) => ids.includes(u.id));
      }
      return users;
    }),
    findAndCount: jest.fn(async () => [users, users.length]),
    count: jest.fn(async () => users.length),
    createQueryBuilder: jest.fn(() => {
      interface MockUserBuilder {
        where: (clause: string) => MockUserBuilder;
        andWhere: (clause: string, params?: Record<string, unknown>) => MockUserBuilder;
        take: (limit: number) => MockUserBuilder;
        getMany: () => Promise<User[]>;
      }
      const builder: MockUserBuilder = {
        where: jest.fn(() => builder),
        andWhere: jest.fn(() => builder),
        take: jest.fn(() => builder),
        getMany: jest.fn(async () => users.filter((u) => u.isActive)),
      };
      return builder;
    }),
  };

  const mockSessionRepository = {
    create: jest.fn((dto: Partial<Session>) => ({ id: randomUUID(), ...dto }) as Session),
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
    update: jest.fn(async () => {}),
    createQueryBuilder: jest.fn(() => {
      interface MockSessionBuilder {
        update: () => MockSessionBuilder;
        set: () => MockSessionBuilder;
        where: () => MockSessionBuilder;
        andWhere: () => MockSessionBuilder;
        execute: () => Promise<void>;
      }
      const builder: MockSessionBuilder = {
        update: jest.fn(() => builder),
        set: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn(() => builder),
        execute: jest.fn(async () => {}),
      };
      return builder;
    }),
  };

  const mockProjectRepository = {
    create: jest.fn(
      (dto: Partial<Project>) =>
        ({
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          status: ProjectStatus.ACTIVE,
          ...dto,
        }) as Project,
    ),
    save: jest.fn(async (project: Project) => {
      const idx = projects.findIndex((p) => p.id === project.id);
      if (idx >= 0) {
        project.version = (project.version ?? 1) + 1;
        projects[idx] = project;
      } else projects.push(project);
      return project;
    }),
    findOne: jest.fn(async (opts: FindOneOptions<Project>) => {
      const where = opts.where as Record<string, unknown> | undefined;
      if (!where) return null;
      return (
        projects.find((p) => {
          if (where.id && p.id !== where.id) return false;
          if (where.key && p.key !== where.key) return false;
          return true;
        }) ?? null
      );
    }),
    find: jest.fn(async () => projects),
  };

  const mockMemberRepository = {
    create: jest.fn(
      (dto: Partial<ProjectMember>) =>
        ({ id: randomUUID(), joinedAt: new Date(), removedAt: null, ...dto }) as ProjectMember,
    ),
    save: jest.fn(async (memberOrMembers: ProjectMember | ProjectMember[]) => {
      const list = Array.isArray(memberOrMembers) ? memberOrMembers : [memberOrMembers];
      for (const m of list) {
        const idx = projectMembers.findIndex((existing) => existing.id === m.id);
        if (idx >= 0) projectMembers[idx] = m;
        else projectMembers.push(m);
      }
      return Array.isArray(memberOrMembers) ? list : list[0];
    }),
    findOne: jest.fn(async (opts: FindOneOptions<ProjectMember>) => {
      const where = opts.where as Record<string, unknown> | undefined;
      if (!where) return null;
      const found = projectMembers.find((m) => {
        if (where.projectId && m.projectId !== where.projectId) return false;
        if (where.userId && m.userId !== where.userId) return false;
        if (where.removedAt === null || 'removedAt' in where) {
          if (m.removedAt !== null) return false;
        }
        return true;
      });
      if (found) {
        const project = projects.find((p) => p.id === found.projectId);
        return { ...found, project: project ?? found.project };
      }
      return null;
    }),
    find: jest.fn(async (opts?: FindManyOptions<ProjectMember>) => {
      const where = opts?.where as Record<string, unknown> | undefined;
      return projectMembers
        .filter((m) => {
          if (!where) return true;
          if (where.projectId && m.projectId !== where.projectId) return false;
          if (where.userId) {
            const val = where.userId as { _type?: string; _value?: string[] } | string;
            if (typeof val === 'object' && val && '_value' in val && Array.isArray(val._value)) {
              if (!val._value.includes(m.userId)) return false;
            } else if (m.userId !== val) {
              return false;
            }
          }
          if (m.removedAt !== null) return false;
          return true;
        })
        .map((m) => {
          const project = projects.find((p) => p.id === m.projectId);
          return { ...m, project: project ?? m.project };
        });
    }),
  };

  const mockAuditRepository = {
    create: jest.fn(
      (dto: Partial<AuditLog>) => ({ id: randomUUID(), createdAt: new Date(), ...dto }) as AuditLog,
    ),
    save: jest.fn(async (log: AuditLog) => {
      auditLogs.push(log);
      return log;
    }),
    findAndCount: jest.fn(async () => [auditLogs, auditLogs.length]),
  };

  const mockRequirementRepository = {
    create: jest.fn(
      (dto: Partial<Requirement>) =>
        ({
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          deletedAt: null,
          ...dto,
        }) as Requirement,
    ),
    save: jest.fn(async (req: Requirement) => {
      const idx = requirements.findIndex((r) => r.id === req.id);
      if (idx >= 0) {
        req.version = (req.version ?? 1) + 1;
        requirements[idx] = req;
      } else requirements.push(req);
      return req;
    }),
    findOne: jest.fn(async (opts: FindOneOptions<Requirement>) => {
      const where = opts.where as Record<string, unknown> | undefined;
      if (!where) return null;
      return (
        requirements.find((r) => {
          if (where.id && r.id !== where.id) return false;
          if (where.projectId && r.projectId !== where.projectId) return false;
          if ('deletedAt' in where && r.deletedAt !== null) return false;
          return true;
        }) ?? null
      );
    }),
  };

  const mockTaskRepository = {
    create: jest.fn(
      (dto: Partial<Task>) =>
        ({
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          deletedAt: null,
          ...dto,
        }) as Task,
    ),
    save: jest.fn(async (task: Task) => {
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        task.version = (task.version ?? 1) + 1;
        task.updatedAt = new Date();
        tasks[idx] = task;
      } else tasks.push(task);
      return task;
    }),
    findOne: jest.fn(async (opts: FindOneOptions<Task>) => {
      const where = opts.where as Record<string, unknown> | undefined;
      if (!where) return null;
      return (
        tasks.find((t) => {
          if (where.id && t.id !== where.id) return false;
          if (where.projectId && t.projectId !== where.projectId) return false;
          if ('deletedAt' in where && t.deletedAt !== null) return false;
          return true;
        }) ?? null
      );
    }),
    find: jest.fn(async (opts?: FindManyOptions<Task>) => {
      const where = opts?.where as Record<string, unknown> | undefined;
      return tasks.filter((t) => {
        if (!where) return true;
        if (where.projectId && t.projectId !== where.projectId) return false;
        if (where.requirementId && t.requirementId !== where.requirementId) return false;
        if (t.deletedAt !== null) return false;
        return true;
      });
    }),
    createQueryBuilder: jest.fn(() => {
      let filtered = [...tasks];
      interface MockTaskBuilder {
        where: (clause: string, params?: Record<string, unknown>) => MockTaskBuilder;
        andWhere: (clause: string, params?: Record<string, unknown>) => MockTaskBuilder;
        orderBy: (col: string, order: string) => MockTaskBuilder;
        addOrderBy: (col: string, order: string) => MockTaskBuilder;
        skip: (n: number) => MockTaskBuilder;
        take: (n: number) => MockTaskBuilder;
        getManyAndCount: () => Promise<[Task[], number]>;
      }
      const builder: MockTaskBuilder = {
        where: jest.fn((_clause: string, params?: Record<string, unknown>) => {
          if (params?.projectId) {
            filtered = tasks.filter(
              (t) => t.projectId === params.projectId && t.deletedAt === null,
            );
          }
          return builder;
        }),
        andWhere: jest.fn((_clause: string, params?: Record<string, unknown>) => {
          if (params?.status) filtered = filtered.filter((t) => t.status === params.status);
          if (params?.priority) filtered = filtered.filter((t) => t.priority === params.priority);
          if (params?.assigneeId)
            filtered = filtered.filter((t) => t.assigneeId === params.assigneeId);
          if (params?.requirementId)
            filtered = filtered.filter((t) => t.requirementId === params.requirementId);
          if (params?.sourceMeetingId)
            filtered = filtered.filter((t) => t.sourceMeetingId === params.sourceMeetingId);
          return builder;
        }),
        orderBy: jest.fn(() => builder),
        addOrderBy: jest.fn(() => builder),
        skip: jest.fn(() => builder),
        take: jest.fn(() => builder),
        getManyAndCount: jest.fn(async () => [filtered, filtered.length] as [Task[], number]),
      };
      return builder;
    }),
  };

  const mockMeetingRepository = {
    create: jest.fn(
      (dto: Partial<Meeting>) =>
        ({
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          deletedAt: null,
          attendees: [],
          ...dto,
        }) as Meeting,
    ),
    save: jest.fn(async (meeting: Meeting) => {
      const idx = meetings.findIndex((m) => m.id === meeting.id);
      if (idx >= 0) {
        meeting.version = (meeting.version ?? 1) + 1;
        meeting.updatedAt = new Date();
        meetings[idx] = meeting;
      } else meetings.push(meeting);
      return meeting;
    }),
    findOne: jest.fn(async (opts: FindOneOptions<Meeting>) => {
      const where = opts.where as Record<string, unknown> | undefined;
      if (!where) return null;
      const found = meetings.find((m) => {
        if (where.id && m.id !== where.id) return false;
        if (where.projectId && m.projectId !== where.projectId) return false;
        if ('deletedAt' in where && m.deletedAt !== null) return false;
        return true;
      });
      if (found) {
        const atts = meetingAttendees
          .filter((a) => a.meetingId === found.id)
          .map((a) => ({
            ...a,
            user: users.find((u) => u.id === a.userId),
          }));
        return { ...found, attendees: atts };
      }
      return null;
    }),
    createQueryBuilder: jest.fn(() => {
      let filtered = [...meetings];
      interface MockMeetingBuilder {
        leftJoinAndSelect: () => MockMeetingBuilder;
        where: (clause: string, params?: Record<string, unknown>) => MockMeetingBuilder;
        andWhere: (clause: string, params?: Record<string, unknown>) => MockMeetingBuilder;
        orderBy: (col: string, order: string) => MockMeetingBuilder;
        addOrderBy: (col: string, order: string) => MockMeetingBuilder;
        skip: (n: number) => MockMeetingBuilder;
        take: (n: number) => MockMeetingBuilder;
        getManyAndCount: () => Promise<[Meeting[], number]>;
      }
      const builder: MockMeetingBuilder = {
        leftJoinAndSelect: jest.fn(() => builder),
        where: jest.fn((_clause: string, params?: Record<string, unknown>) => {
          if (params?.projectId) {
            filtered = meetings.filter(
              (m) => m.projectId === params.projectId && m.deletedAt === null,
            );
          }
          return builder;
        }),
        andWhere: jest.fn((_clause: string, params?: Record<string, unknown>) => {
          if (params?.from) filtered = filtered.filter((m) => m.startsAt >= params.from!);
          if (params?.to) filtered = filtered.filter((m) => m.startsAt <= params.to!);
          return builder;
        }),
        orderBy: jest.fn(() => builder),
        addOrderBy: jest.fn(() => builder),
        skip: jest.fn(() => builder),
        take: jest.fn(() => builder),
        getManyAndCount: jest.fn(async () => [filtered, filtered.length] as [Meeting[], number]),
      };
      return builder;
    }),
  };

  const mockAttendeeRepository = {
    create: jest.fn((dto: Partial<MeetingAttendee>) => ({ ...dto }) as MeetingAttendee),
    save: jest.fn(async (atts: MeetingAttendee | MeetingAttendee[]) => {
      const list = Array.isArray(atts) ? atts : [atts];
      for (const a of list) {
        const idx = meetingAttendees.findIndex(
          (m) => m.meetingId === a.meetingId && m.userId === a.userId,
        );
        if (idx < 0) meetingAttendees.push(a);
      }
      return atts;
    }),
    delete: jest.fn(async (criteria: { meetingId: string }) => {
      const remaining = meetingAttendees.filter((a) => a.meetingId !== criteria.meetingId);
      meetingAttendees.length = 0;
      meetingAttendees.push(...remaining);
    }),
  };

  const mockEntityManager = {
    create: jest.fn((entityClass: unknown, dto: unknown) => {
      if (entityClass === Task) return mockTaskRepository.create(dto as Partial<Task>);
      if (entityClass === Meeting) return mockMeetingRepository.create(dto as Partial<Meeting>);
      if (entityClass === MeetingAttendee)
        return mockAttendeeRepository.create(dto as Partial<MeetingAttendee>);
      return { id: randomUUID(), ...(dto as object) };
    }),
    save: jest.fn(async (entityClass: unknown, entity: unknown) => {
      if (entityClass === Task) return mockTaskRepository.save(entity as Task);
      if (entityClass === Meeting) return mockMeetingRepository.save(entity as Meeting);
      if (entityClass === MeetingAttendee)
        return mockAttendeeRepository.save(entity as MeetingAttendee[]);
      return entity;
    }),
    delete: jest.fn(async (entityClass: unknown, criteria: unknown) => {
      if (entityClass === MeetingAttendee) {
        return mockAttendeeRepository.delete(criteria as { meetingId: string });
      }
    }),
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('MAX("number")') && sql.includes('tasks')) {
        const projectId = (params as string[])?.[0];
        const maxNum = tasks
          .filter((t) => t.projectId === projectId)
          .reduce((max, t) => Math.max(max, t.number ?? 0), 0);
        return [{ max: maxNum || null }];
      }
      return [{ max: null }];
    }),
  };

  const mockDataSource = {
    entityMetadatas: [] as unknown[],
    options: { type: 'postgres' },
    getRepository: jest.fn(() => ({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    })),
    transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) =>
      cb(mockEntityManager),
    ),
  };

  let ownerUser: User;
  let contributorUser: User;
  let viewerUser: User;
  let outsiderUser: User;

  const userPassword = 'TestPassword123!';

  let ownerAuth: { cookies: string[]; csrfToken: string };
  let contributorAuth: { cookies: string[]; csrfToken: string };
  let viewerAuth: { cookies: string[]; csrfToken: string };
  let outsiderAuth: { cookies: string[]; csrfToken: string };

  let testProjectId: string;
  const testProjectKey = 'TASKTEST';
  let linkedReqId: string;

  function extractCookies(res: request.Response): string[] {
    const header = res.headers['set-cookie'];
    if (!header) return [];
    const array = Array.isArray(header) ? header : [header];
    return array.map((c) => c.split(';')[0].trim());
  }

  async function loginUser(email: string): Promise<{ cookies: string[]; csrfToken: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: userPassword })
      .expect(200);
    return { cookies: extractCookies(res), csrfToken: res.body.data.csrfToken };
  }

  beforeAll(async () => {
    passwordService = new PasswordService();
    const passwordHash = await passwordService.hash(userPassword);

    ownerUser = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'owner@tasktest.local',
      displayName: 'Owner User',
      passwordHash,
      systemRole: SystemRole.USER,
      professionalRole: ProfessionalRole.DEVELOPER,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(ownerUser);

    contributorUser = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'contributor@tasktest.local',
      displayName: 'Contributor User',
      passwordHash,
      systemRole: SystemRole.USER,
      professionalRole: ProfessionalRole.QA,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(contributorUser);

    viewerUser = {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'viewer@tasktest.local',
      displayName: 'Viewer User',
      passwordHash,
      systemRole: SystemRole.USER,
      professionalRole: ProfessionalRole.PM,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(viewerUser);

    outsiderUser = {
      id: '44444444-4444-4444-8444-444444444444',
      email: 'outsider@tasktest.local',
      displayName: 'Outsider User',
      passwordHash,
      systemRole: SystemRole.USER,
      professionalRole: ProfessionalRole.INFRASTRUCTURE,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(outsiderUser);

    testProjectId = randomUUID();
    const project: Project = {
      id: testProjectId,
      key: testProjectKey,
      name: 'Task & Meeting Test Project',
      description: null,
      status: ProjectStatus.ACTIVE,
      createdBy: ownerUser.id,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    projects.push(project);

    projectMembers.push({
      id: randomUUID(),
      projectId: testProjectId,
      userId: ownerUser.id,
      accessRole: ProjectRole.OWNER,
      joinedAt: new Date(),
      removedAt: null,
    } as ProjectMember);

    projectMembers.push({
      id: randomUUID(),
      projectId: testProjectId,
      userId: contributorUser.id,
      accessRole: ProjectRole.CONTRIBUTOR,
      joinedAt: new Date(),
      removedAt: null,
    } as ProjectMember);

    projectMembers.push({
      id: randomUUID(),
      projectId: testProjectId,
      userId: viewerUser.id,
      accessRole: ProjectRole.VIEWER,
      joinedAt: new Date(),
      removedAt: null,
    } as ProjectMember);

    linkedReqId = randomUUID();
    requirements.push({
      id: linkedReqId,
      projectId: testProjectId,
      number: 1,
      title: 'Linked Req',
      description: null,
      acceptanceCriteria: null,
      status:
        'APPROVED' as unknown as import('../../src/modules/requirements/entities/requirement.entity').RequirementStatus,
      priority: Priority.HIGH,
      sourceMeetingId: null,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
      version: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Requirement);

    @Global()
    @Module({
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({
            NODE_ENV: 'development',
            PORT: 3000,
            APP_ORIGIN: 'http://localhost:3001',
            SESSION_IDLE_HOURS: 8,
            SESSION_ABSOLUTE_DAYS: 7,
            STORAGE_LOCAL_ROOT: './var/uploads',
          }),
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: OutboxService, useValue: { emit: jest.fn().mockResolvedValue({}) } },
      ],
      exports: [ConfigService, DataSource, OutboxService],
    })
    class TestDependencies {}

    const fixture = await Test.createTestingModule({
      imports: [
        TestDependencies,
        UsersModule,
        AuthModule,
        ProjectsModule,
        RequirementsModule,
        DecisionsModule,
        TasksModule,
        MeetingsModule,
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
      .useValue(mockMemberRepository)
      .overrideProvider(getRepositoryToken(AuditLog))
      .useValue(mockAuditRepository)
      .overrideProvider(getRepositoryToken(Requirement))
      .useValue(mockRequirementRepository)
      .overrideProvider(getRepositoryToken(RequirementRevision))
      .useValue({ save: jest.fn(), find: jest.fn() })
      .overrideProvider(getRepositoryToken(Decision))
      .useValue({ findOne: jest.fn() })
      .overrideProvider(getRepositoryToken(DecisionRevision))
      .useValue({ save: jest.fn() })
      .overrideProvider(getRepositoryToken(Task))
      .useValue(mockTaskRepository)
      .overrideProvider(getRepositoryToken(Meeting))
      .useValue(mockMeetingRepository)
      .overrideProvider(getRepositoryToken(MeetingAttendee))
      .useValue(mockAttendeeRepository)
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .compile();

    app = fixture.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();

    ownerAuth = await loginUser(ownerUser.email);
    contributorAuth = await loginUser(contributorUser.email);
    viewerAuth = await loginUser(viewerUser.email);
    outsiderAuth = await loginUser(outsiderUser.email);
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  const BASE = () => `/api/v1/projects/${testProjectId}`;

  // ──────────────── TASKS ────────────────

  let createdTaskId: string;

  describe('Tasks - Create', () => {
    it('should create a task as Owner', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE()}/tasks`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({
          title: 'Implement auth guard',
          description: 'Guard endpoints with session check',
          status: 'TODO',
          priority: 'HIGH',
          assigneeId: contributorUser.id,
          dueDate: '2026-10-01',
          requirementId: linkedReqId,
        })
        .expect(201);

      expect(res.body.data.title).toBe('Implement auth guard');
      expect(res.body.data.number).toBe(1);
      expect(res.body.data.displayKey).toBe(`${testProjectKey}-TASK-1`);
      expect(res.body.data.status).toBe('TODO');
      expect(res.body.data.priority).toBe('HIGH');
      expect(res.body.data.assigneeId).toBe(contributorUser.id);
      expect(res.body.data.requirementId).toBe(linkedReqId);
      createdTaskId = res.body.data.id;
    });

    it('should reject assignee from outside project', async () => {
      await request(app.getHttpServer())
        .post(`${BASE()}/tasks`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({
          title: 'Invalid Assignee Task',
          assigneeId: outsiderUser.id,
        })
        .expect(400);
    });

    it('should reject requirement from outside project', async () => {
      await request(app.getHttpServer())
        .post(`${BASE()}/tasks`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({
          title: 'Invalid Req Task',
          requirementId: randomUUID(),
        })
        .expect(400);
    });

    it('should reject creation by VIEWER', async () => {
      await request(app.getHttpServer())
        .post(`${BASE()}/tasks`)
        .set('Cookie', viewerAuth.cookies)
        .set('x-csrf-token', viewerAuth.csrfToken)
        .send({ title: 'Viewer task' })
        .expect(403);
    });

    it('should return 404 for outsider (privacy)', async () => {
      await request(app.getHttpServer())
        .post(`${BASE()}/tasks`)
        .set('Cookie', outsiderAuth.cookies)
        .set('x-csrf-token', outsiderAuth.csrfToken)
        .send({ title: 'Outsider task' })
        .expect(404);
    });
  });

  describe('Tasks - List and Get', () => {
    it('should list tasks for project member', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}/tasks`)
        .set('Cookie', viewerAuth.cookies)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('should get task by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}/tasks/${createdTaskId}`)
        .set('Cookie', ownerAuth.cookies)
        .expect(200);

      expect(res.body.data.id).toBe(createdTaskId);
      expect(res.body.data.displayKey).toContain('TASK-');
    });

    it('should return 404 for non-existent task', async () => {
      await request(app.getHttpServer())
        .get(`${BASE()}/tasks/${randomUUID()}`)
        .set('Cookie', ownerAuth.cookies)
        .expect(404);
    });
  });

  describe('Tasks - Update', () => {
    it('should update task status and priority', async () => {
      const current = tasks.find((t) => t.id === createdTaskId)!;
      const res = await request(app.getHttpServer())
        .patch(`${BASE()}/tasks/${createdTaskId}`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({ version: current.version, status: 'IN_PROGRESS', priority: 'URGENT' })
        .expect(200);

      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.priority).toBe('URGENT');
    });

    it('should reject stale version with 409 Conflict', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE()}/tasks/${createdTaskId}`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({ version: 1, title: 'Stale' })
        .expect(409);
    });

    it('should reject update by VIEWER', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE()}/tasks/${createdTaskId}`)
        .set('Cookie', viewerAuth.cookies)
        .set('x-csrf-token', viewerAuth.csrfToken)
        .send({ version: 2, title: 'Should fail' })
        .expect(403);
    });
  });

  describe('Tasks - Requirement Linkage Wire-Up', () => {
    it('should return linked tasks when querying requirement tasks endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}/requirements/${linkedReqId}/tasks`)
        .set('Cookie', ownerAuth.cookies)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].requirementId).toBe(linkedReqId);
    });
  });

  describe('Tasks - Soft Delete', () => {
    it('should allow Owner to delete task', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`${BASE()}/tasks`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .send({ title: 'Task to delete' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`${BASE()}/tasks/${createRes.body.data.id}`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .expect(204);
    });

    it('should forbid Contributor from deleting others task', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`${BASE()}/tasks`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({ title: 'Owner task' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`${BASE()}/tasks/${createRes.body.data.id}`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .expect(403);
    });
  });

  // ──────────────── MEETINGS ────────────────

  let createdMeetingId: string;

  describe('Meetings - Create', () => {
    it('should create meeting as Owner with attendees', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE()}/meetings`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({
          title: 'Sprint Retrospective',
          startsAt: '2026-09-20T14:00:00.000Z',
          endsAt: '2026-09-20T15:00:00.000Z',
          agenda: 'Review what went well and what to improve',
          notes: 'Team agreed to improve code review turnarounds',
          attendeeUserIds: [ownerUser.id, contributorUser.id],
        })
        .expect(201);

      expect(res.body.data.title).toBe('Sprint Retrospective');
      expect(res.body.data.attendees.length).toBe(2);
      expect(res.body.data.transcriptVersion).toBe(1);
      createdMeetingId = res.body.data.id;
    });

    it('should reject meeting if endsAt <= startsAt', async () => {
      await request(app.getHttpServer())
        .post(`${BASE()}/meetings`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({
          title: 'Invalid Meeting Time',
          startsAt: '2026-09-20T15:00:00.000Z',
          endsAt: '2026-09-20T14:00:00.000Z',
        })
        .expect(400);
    });

    it('should reject meeting if attendee is outside project', async () => {
      await request(app.getHttpServer())
        .post(`${BASE()}/meetings`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({
          title: 'External Attendee Meeting',
          startsAt: '2026-09-20T14:00:00.000Z',
          endsAt: '2026-09-20T15:00:00.000Z',
          attendeeUserIds: [outsiderUser.id],
        })
        .expect(400);
    });

    it('should reject meeting creation by VIEWER', async () => {
      await request(app.getHttpServer())
        .post(`${BASE()}/meetings`)
        .set('Cookie', viewerAuth.cookies)
        .set('x-csrf-token', viewerAuth.csrfToken)
        .send({
          title: 'Viewer Meeting',
          startsAt: '2026-09-20T14:00:00.000Z',
          endsAt: '2026-09-20T15:00:00.000Z',
        })
        .expect(403);
    });
  });

  describe('Meetings - List and Get', () => {
    it('should list meetings for project member', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}/meetings`)
        .set('Cookie', viewerAuth.cookies)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should get meeting by ID with attendees', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}/meetings/${createdMeetingId}`)
        .set('Cookie', ownerAuth.cookies)
        .expect(200);

      expect(res.body.data.id).toBe(createdMeetingId);
      expect(res.body.data.attendees.length).toBe(2);
    });
  });

  describe('Meetings - Update', () => {
    it('should update transcript and increment transcriptVersion', async () => {
      const current = meetings.find((m) => m.id === createdMeetingId)!;
      const res = await request(app.getHttpServer())
        .patch(`${BASE()}/meetings/${createdMeetingId}`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({
          version: current.version,
          transcriptText: 'Speaker 1: Welcome to the retrospective meeting.',
        })
        .expect(200);

      expect(res.body.data.transcriptText).toBe('Speaker 1: Welcome to the retrospective meeting.');
      expect(res.body.data.transcriptVersion).toBe(2);
    });

    it('should reject stale version with 409 Conflict', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE()}/meetings/${createdMeetingId}`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .send({ version: 1, title: 'Stale Meeting' })
        .expect(409);
    });
  });

  describe('Meetings - Soft Delete', () => {
    it('should soft delete meeting as Owner', async () => {
      await request(app.getHttpServer())
        .delete(`${BASE()}/meetings/${createdMeetingId}`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .expect(204);
    });
  });
});
