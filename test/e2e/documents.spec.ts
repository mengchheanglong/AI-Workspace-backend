import 'reflect-metadata';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, FindManyOptions, FindOneOptions } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureApp } from '../../src/common/configure-app';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { UsersModule } from '../../src/modules/users/users.module';
import { ProjectsModule } from '../../src/modules/projects/projects.module';
import { StorageModule } from '../../src/modules/storage/storage.module';
import { DocumentsModule } from '../../src/modules/documents/documents.module';
import { AuditModule } from '../../src/modules/audit/audit.module';
import { User, SystemRole, ProfessionalRole } from '../../src/modules/users/entities/user.entity';
import { Session } from '../../src/modules/auth/entities/session.entity';
import { Project, ProjectStatus } from '../../src/modules/projects/entities/project.entity';
import {
  ProjectMember,
  ProjectRole,
} from '../../src/modules/projects/entities/project-member.entity';
import { AuditLog } from '../../src/modules/audit/entities/audit-log.entity';
import { Document, ProcessingStatus } from '../../src/modules/documents/entities/document.entity';
import { DocumentRevision } from '../../src/modules/documents/entities/document-revision.entity';
import { PasswordService } from '../../src/modules/auth/services/password.service';
import { OutboxService } from '../../src/modules/ingestion/outbox.service';

describe('Documents and File Storage API (E2E)', () => {
  let app: INestApplication;
  let tempUploadRoot: string;

  const users: User[] = [];
  const sessions: Session[] = [];
  const projects: Project[] = [];
  const projectMembers: ProjectMember[] = [];
  const auditLogs: AuditLog[] = [];
  const documents: Document[] = [];
  const documentRevisions: DocumentRevision[] = [];

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
    create: jest.fn((dto: Partial<Session>) => ({ id: randomUUID(), ...dto }) as Session),
    save: jest.fn(async (session: Session) => {
      const idx = sessions.findIndex((s) => s.id === session.id);
      if (idx >= 0) sessions[idx] = session;
      else sessions.push(session);
      return session;
    }),
    findOne: jest.fn(async (opts: { where: { tokenHash?: string } }) => {
      if (opts.where.tokenHash) {
        const found = sessions.find(
          (s) => s.tokenHash === opts.where.tokenHash && s.revokedAt === null,
        );
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
          status: ProjectStatus.ACTIVE,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
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
        if ('removedAt' in where && m.removedAt !== null) return false;
        return true;
      });
      if (found && !found.project) {
        found.project = projects.find((p) => p.id === found.projectId)!;
      }
      return found ?? null;
    }),
    find: jest.fn(async () => projectMembers),
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

  const mockDocumentRepository = {
    create: jest.fn(
      (dto: Partial<Document>) =>
        ({
          id: dto.id ?? randomUUID(),
          revision: 1,
          version: 1,
          processingStatus: ProcessingStatus.PENDING,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...dto,
        }) as Document,
    ),
    save: jest.fn(async (doc: Document) => {
      const idx = documents.findIndex((d) => d.id === doc.id);
      if (idx >= 0) {
        doc.version = (doc.version ?? 1) + 1;
        doc.updatedAt = new Date();
        documents[idx] = doc;
      } else {
        documents.push(doc);
      }
      return doc;
    }),
    findOne: jest.fn(async (opts: FindOneOptions<Document>) => {
      const where = opts.where as Record<string, unknown> | undefined;
      if (!where) return null;
      return (
        documents.find((d) => {
          if (where.id && d.id !== where.id) return false;
          if (where.projectId && d.projectId !== where.projectId) return false;
          if ('deletedAt' in where && d.deletedAt !== null) return false;
          return true;
        }) ?? null
      );
    }),
    createQueryBuilder: jest.fn(() => {
      let filtered = [...documents];
      interface MockDocBuilder {
        where: (clause: string, params?: Record<string, unknown>) => MockDocBuilder;
        andWhere: (clause: string, params?: Record<string, unknown>) => MockDocBuilder;
        orderBy: (col: string, order: string) => MockDocBuilder;
        addOrderBy: (col: string, order: string) => MockDocBuilder;
        skip: (n: number) => MockDocBuilder;
        take: (n: number) => MockDocBuilder;
        getManyAndCount: () => Promise<[Document[], number]>;
      }
      const builder: MockDocBuilder = {
        where: jest.fn((_clause: string, params?: Record<string, unknown>) => {
          if (params?.projectId) {
            filtered = documents.filter(
              (d) => d.projectId === params.projectId && d.deletedAt === null,
            );
          }
          return builder;
        }),
        andWhere: jest.fn((clause: string, params?: Record<string, unknown>) => {
          if (clause.includes('deletedAt IS NULL')) {
            filtered = filtered.filter((d) => d.deletedAt === null);
          }
          if (params?.mimeType) {
            filtered = filtered.filter((d) => d.mimeType === params.mimeType);
          }
          if (params?.processingStatus) {
            filtered = filtered.filter((d) => d.processingStatus === params.processingStatus);
          }
          if (params?.search) {
            const s = String(params.search).toLowerCase();
            filtered = filtered.filter(
              (d) =>
                d.title.toLowerCase().includes(s) ||
                (d.description && d.description.toLowerCase().includes(s)) ||
                d.originalFilename.toLowerCase().includes(s),
            );
          }
          return builder;
        }),
        orderBy: jest.fn(() => builder),
        addOrderBy: jest.fn(() => builder),
        skip: jest.fn(() => builder),
        take: jest.fn(() => builder),
        getManyAndCount: jest.fn(async () => [filtered, filtered.length] as [Document[], number]),
      };
      return builder;
    }),
  };

  const mockDocumentRevisionRepository = {
    create: jest.fn(
      (dto: Partial<DocumentRevision>) =>
        ({
          id: randomUUID(),
          createdAt: new Date(),
          ...dto,
        }) as DocumentRevision,
    ),
    save: jest.fn(async (rev: DocumentRevision) => {
      documentRevisions.push(rev);
      return rev;
    }),
    find: jest.fn(async (opts?: FindManyOptions<DocumentRevision>) => {
      const where = opts?.where as Record<string, unknown> | undefined;
      if (!where) return documentRevisions;
      return documentRevisions
        .filter((r) => {
          if (where.documentId && r.documentId !== where.documentId) return false;
          return true;
        })
        .sort((a, b) => b.revision - a.revision);
    }),
  };

  const mockEntityManager = {
    getRepository: jest.fn((entityClass: unknown) => {
      if (entityClass === Document) return mockDocumentRepository;
      if (entityClass === DocumentRevision) return mockDocumentRevisionRepository;
      return {};
    }),
  };

  const mockDataSource = {
    entityMetadatas: [] as unknown[],
    options: { type: 'postgres' },
    getRepository: jest.fn(() => ({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    })),
    transaction: jest.fn(async (cb: (em: typeof mockEntityManager) => Promise<unknown>) => {
      return cb(mockEntityManager);
    }),
  };

  let ownerUser: User;
  let managerUser: User;
  let contributorUser: User;
  let viewerUser: User;
  let outsiderUser: User;

  const userPassword = 'TestPassword123!';

  let ownerAuth: { cookies: string[]; csrfToken: string };
  let managerAuth: { cookies: string[]; csrfToken: string };
  let contributorAuth: { cookies: string[]; csrfToken: string };
  let viewerAuth: { cookies: string[]; csrfToken: string };
  let outsiderAuth: { cookies: string[]; csrfToken: string };

  let testProjectId: string;
  let projectBId: string;

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
    tempUploadRoot = await mkdtemp(join(tmpdir(), 'e2e-documents-uploads-'));

    const passwordService = new PasswordService();
    const passwordHash = await passwordService.hash(userPassword);

    ownerUser = {
      id: randomUUID(),
      email: 'owner@example.com',
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

    managerUser = {
      id: randomUUID(),
      email: 'manager@example.com',
      displayName: 'Manager User',
      passwordHash,
      systemRole: SystemRole.USER,
      professionalRole: ProfessionalRole.PM,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(managerUser);

    contributorUser = {
      id: randomUUID(),
      email: 'contrib@example.com',
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
      id: randomUUID(),
      email: 'viewer@example.com',
      displayName: 'Viewer User',
      passwordHash,
      systemRole: SystemRole.USER,
      professionalRole: ProfessionalRole.DEVELOPER,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(viewerUser);

    outsiderUser = {
      id: randomUUID(),
      email: 'outsider@example.com',
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
    const projectA: Project = {
      id: testProjectId,
      name: 'Project Alpha',
      key: 'ALPHA',
      description: 'Alpha project',
      status: ProjectStatus.ACTIVE,
      createdBy: ownerUser.id,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    projects.push(projectA);

    projectMembers.push(
      {
        id: randomUUID(),
        projectId: testProjectId,
        userId: ownerUser.id,
        accessRole: ProjectRole.OWNER,
        joinedAt: new Date(),
        removedAt: null,
      } as ProjectMember,
      {
        id: randomUUID(),
        projectId: testProjectId,
        userId: managerUser.id,
        accessRole: ProjectRole.MANAGER,
        joinedAt: new Date(),
        removedAt: null,
      } as ProjectMember,
      {
        id: randomUUID(),
        projectId: testProjectId,
        userId: contributorUser.id,
        accessRole: ProjectRole.CONTRIBUTOR,
        joinedAt: new Date(),
        removedAt: null,
      } as ProjectMember,
      {
        id: randomUUID(),
        projectId: testProjectId,
        userId: viewerUser.id,
        accessRole: ProjectRole.VIEWER,
        joinedAt: new Date(),
        removedAt: null,
      } as ProjectMember,
    );

    projectBId = randomUUID();
    projects.push({
      id: projectBId,
      name: 'Project Beta',
      key: 'BETA',
      description: 'Beta project',
      status: ProjectStatus.ACTIVE,
      createdBy: outsiderUser.id,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    projectMembers.push({
      id: randomUUID(),
      projectId: projectBId,
      userId: outsiderUser.id,
      accessRole: ProjectRole.OWNER,
      joinedAt: new Date(),
      removedAt: null,
    } as ProjectMember);

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
            STORAGE_LOCAL_ROOT: tempUploadRoot,
            MAX_UPLOAD_BYTES: 20971520,
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
        AuthModule,
        UsersModule,
        AuditModule,
        ProjectsModule,
        StorageModule,
        DocumentsModule,
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
      .overrideProvider(getRepositoryToken(Document))
      .useValue(mockDocumentRepository)
      .overrideProvider(getRepositoryToken(DocumentRevision))
      .useValue(mockDocumentRevisionRepository)
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .compile();

    app = fixture.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();

    ownerAuth = await loginUser(ownerUser.email);
    managerAuth = await loginUser(managerUser.email);
    contributorAuth = await loginUser(contributorUser.email);
    viewerAuth = await loginUser(viewerUser.email);
    outsiderAuth = await loginUser(outsiderUser.email);
  }, 60000);

  afterAll(async () => {
    await app?.close();
    await rm(tempUploadRoot, { recursive: true, force: true });
  });

  // ── Tests ─────────────────────────────────────────────────────────

  describe('1. File Upload (POST /projects/:projectId/documents)', () => {
    it('allows CONTRIBUTOR to upload a valid PDF document', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 Architecture Specification\n%EOF');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', pdfBuffer, 'architecture.pdf')
        .field('title', 'Architecture Specification')
        .field('description', 'High level system diagram');

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('Architecture Specification');
      expect(res.body.data.originalFilename).toBe('architecture.pdf');
      expect(res.body.data.mimeType).toBe('application/pdf');
      expect(res.body.data.revision).toBe(1);
      expect(res.body.data.processingStatus).toBe(ProcessingStatus.PENDING);
      expect(res.body.data.createdBy).toBe(contributorUser.id);
    });

    it('allows OWNER to upload a valid DOCX document', async () => {
      const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .attach('file', docxHeader, 'requirements.docx')
        .field('title', 'Requirements Document');

      expect(res.status).toBe(201);
      expect(res.body.data.originalFilename).toBe('requirements.docx');
      expect(res.body.data.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('allows MANAGER to upload a valid TXT document and Markdown document', async () => {
      const txtBuffer = Buffer.from('Plain text notes\nNo null bytes here');
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', managerAuth.cookies)
        .set('x-csrf-token', managerAuth.csrfToken)
        .attach('file', txtBuffer, 'notes.txt');

      expect(res1.status).toBe(201);
      expect(res1.body.data.mimeType).toBe('text/plain');

      const mdBuffer = Buffer.from('# Markdown Readme\n\nSome details');
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', managerAuth.cookies)
        .set('x-csrf-token', managerAuth.csrfToken)
        .attach('file', mdBuffer, 'guide.md');

      expect(res2.status).toBe(201);
      expect(res2.body.data.mimeType).toBe('text/markdown');
    });

    it('rejects upload without a file attached with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .field('title', 'Missing file');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects unsupported file extension (.exe) with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const exeBuffer = Buffer.from('MZ\x90\x00\x03');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', exeBuffer, 'malware.exe');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects disguised PDF file with text content (invalid magic bytes) with 415', async () => {
      const fakePdf = Buffer.from('NOT A REAL PDF FILE');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', fakePdf, 'fake.pdf');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects disguised DOCX file (invalid magic bytes) with 415', async () => {
      const fakeDocx = Buffer.from('NOT A REAL DOCX FILE');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', fakeDocx, 'fake.docx');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects text file containing binary null bytes with 415', async () => {
      const nullBytesBuffer = Buffer.from('binary\x00data');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', nullBytesBuffer, 'binary.txt');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('blocks VIEWER role from uploading documents with 403 FORBIDDEN', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 Viewer test');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', viewerAuth.cookies)
        .set('x-csrf-token', viewerAuth.csrfToken)
        .attach('file', pdfBuffer, 'viewer.pdf');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 PROJECT_NOT_FOUND when non-member uploads', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 Outsider test');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', outsiderAuth.cookies)
        .set('x-csrf-token', outsiderAuth.csrfToken)
        .attach('file', pdfBuffer, 'outsider.pdf');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('2. Document Listing (GET /projects/:projectId/documents)', () => {
    it('lists project documents with pagination and metadata', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
    });

    it('allows VIEWER to list documents', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', viewerAuth.cookies);

      expect(res.status).toBe(200);
    });

    it('filters documents by mimeType', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents?mimeType=application/pdf`)
        .set('Cookie', ownerAuth.cookies);

      expect(res.status).toBe(200);
      for (const doc of res.body.data) {
        expect(doc.mimeType).toBe('application/pdf');
      }
    });

    it('returns 404 PROJECT_NOT_FOUND for outsider', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', outsiderAuth.cookies);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('3. Document Detail (GET /projects/:projectId/documents/:id)', () => {
    let testDocId: string;

    beforeAll(async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 Detail Test Doc');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', pdfBuffer, 'detail.pdf')
        .field('title', 'Detail Test Document');
      testDocId = res.body.data.id;
    });

    it('returns document metadata by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents/${testDocId}`)
        .set('Cookie', contributorAuth.cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testDocId);
      expect(res.body.data.title).toBe('Detail Test Document');
    });

    it('returns 404 for non-existent document ID', async () => {
      const fakeId = randomUUID();
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents/${fakeId}`)
        .set('Cookie', contributorAuth.cookies);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('returns 404 for outsider accessing document', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents/${testDocId}`)
        .set('Cookie', outsiderAuth.cookies);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('4. Document Update (PATCH /projects/:projectId/documents/:id)', () => {
    let testDocId: string;
    let initialVersion: number;

    beforeAll(async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 Update Test Doc');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', pdfBuffer, 'update.pdf')
        .field('title', 'Initial Title')
        .field('description', 'Initial Description');
      testDocId = res.body.data.id;
      initialVersion = res.body.data.version;
    });

    it('updates title and description with matching version', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${testProjectId}/documents/${testDocId}`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .send({
          version: initialVersion,
          title: 'Updated Title',
          description: 'Updated Description',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.data.description).toBe('Updated Description');
      expect(res.body.data.version).toBe(initialVersion + 1);
    });

    it('rejects update with stale version with 409 CONCURRENCY_CONFLICT', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${testProjectId}/documents/${testDocId}`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .send({
          version: initialVersion, // stale
          title: 'Conflicting Title',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONCURRENCY_CONFLICT');
    });

    it('blocks VIEWER from updating metadata with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${testProjectId}/documents/${testDocId}`)
        .set('Cookie', viewerAuth.cookies)
        .set('x-csrf-token', viewerAuth.csrfToken)
        .send({
          version: initialVersion + 1,
          title: 'Viewer Change',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('5. Secure Download (GET /projects/:projectId/documents/:id/download)', () => {
    let testDocId: string;
    const fileContent = '%PDF-1.4 Downloadable content for verification';

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', Buffer.from(fileContent), 'download_spec.pdf');
      testDocId = res.body.data.id;
    });

    it('streams file with attachment header and nosniff', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents/${testDocId}/download`)
        .set('Cookie', viewerAuth.cookies)
        .buffer(true);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe('attachment; filename="download_spec.pdf"');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      const text = res.text || res.body.toString('utf-8');
      expect(text).toBe(fileContent);
    });

    it('denies download to non-members with 404 PROJECT_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents/${testDocId}/download`)
        .set('Cookie', outsiderAuth.cookies);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('6. Document Replacement Revisions (POST & GET revisions)', () => {
    let testDocId: string;
    const initialContent = '%PDF-1.4 Initial Version 1 Content';
    const replacementContent = '%PDF-1.4 Replacement Version 2 Content';

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', Buffer.from(initialContent), 'doc_v1.pdf')
        .field('title', 'Versioned Document');
      testDocId = res.body.data.id;
    });

    it('uploads a replacement file creating revision 2', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents/${testDocId}/revisions`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', Buffer.from(replacementContent), 'doc_v2.pdf');

      expect(res.status).toBe(201);
      expect(res.body.data.revision).toBe(2);
      expect(res.body.data.originalFilename).toBe('doc_v2.pdf');
      expect(res.body.data.processingStatus).toBe(ProcessingStatus.PENDING);
    });

    it('lists revisions showing both revision 2 and revision 1', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents/${testDocId}/revisions`)
        .set('Cookie', viewerAuth.cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].revision).toBe(2);
      expect(res.body.data[1].revision).toBe(1);
    });

    it('downloading document retrieves the latest (v2) content', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents/${testDocId}/download`)
        .set('Cookie', contributorAuth.cookies)
        .buffer(true);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe('attachment; filename="doc_v2.pdf"');
      const text = res.text || res.body.toString('utf-8');
      expect(text).toBe(replacementContent);
    });

    it('blocks VIEWER from uploading replacement revisions with 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents/${testDocId}/revisions`)
        .set('Cookie', viewerAuth.cookies)
        .set('x-csrf-token', viewerAuth.csrfToken)
        .attach('file', Buffer.from('%PDF-1.4 viewer hack'), 'hack.pdf');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('7. Role-Scoped Soft-Delete (DELETE /projects/:projectId/documents/:id)', () => {
    let ownerDocId: string;
    let contribDocId: string;

    beforeAll(async () => {
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken)
        .attach('file', Buffer.from('%PDF-1.4 Owner Doc'), 'owner_doc.pdf')
        .field('title', 'Owner Created Doc');
      ownerDocId = res1.body.data.id;

      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/projects/${testProjectId}/documents`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken)
        .attach('file', Buffer.from('%PDF-1.4 Contrib Doc'), 'contrib_doc.pdf')
        .field('title', 'Contrib Created Doc');
      contribDocId = res2.body.data.id;
    });

    it('forbids CONTRIBUTOR from deleting document created by OWNER (403 FORBIDDEN)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${testProjectId}/documents/${ownerDocId}`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('forbids VIEWER from deleting any document (403 FORBIDDEN)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${testProjectId}/documents/${contribDocId}`)
        .set('Cookie', viewerAuth.cookies)
        .set('x-csrf-token', viewerAuth.csrfToken);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows CONTRIBUTOR to delete their own document (204 NO_CONTENT)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${testProjectId}/documents/${contribDocId}`)
        .set('Cookie', contributorAuth.cookies)
        .set('x-csrf-token', contributorAuth.csrfToken);

      expect(res.status).toBe(204);
    });

    it('allows OWNER to delete any document (204 NO_CONTENT)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${testProjectId}/documents/${ownerDocId}`)
        .set('Cookie', ownerAuth.cookies)
        .set('x-csrf-token', ownerAuth.csrfToken);

      expect(res.status).toBe(204);
    });

    it('denies download of soft-deleted document with 404 DOCUMENT_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${testProjectId}/documents/${contribDocId}/download`)
        .set('Cookie', ownerAuth.cookies);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });
});
