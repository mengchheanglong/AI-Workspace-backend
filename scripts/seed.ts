import 'reflect-metadata';
import * as argon2 from 'argon2';
import AppDataSource from '../src/database/data-source';
import { User, SystemRole, ProfessionalRole } from '../src/modules/users/entities/user.entity';
import { Project, ProjectStatus } from '../src/modules/projects/entities/project.entity';
import { ProjectMember, ProjectRole } from '../src/modules/projects/entities/project-member.entity';
import {
  Requirement,
  RequirementStatus,
  Priority,
} from '../src/modules/requirements/entities/requirement.entity';
import { Decision, DecisionStatus } from '../src/modules/decisions/entities/decision.entity';
import { Task, TaskStatus } from '../src/modules/tasks/entities/task.entity';
import { Meeting } from '../src/modules/meetings/entities/meeting.entity';
import { MeetingAttendee } from '../src/modules/meetings/entities/meeting-attendee.entity';
import { Document, ProcessingStatus } from '../src/modules/documents/entities/document.entity';
import { AuditLog } from '../src/modules/audit/entities/audit-log.entity';

async function seed() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== 'true') {
    throw new Error(
      'Seeding is blocked in production environment. Set FORCE_SEED=true to override.',
    );
  }

  console.log('Connecting to database for seeding...');
  await AppDataSource.initialize();

  try {
    const userRepo = AppDataSource.getRepository(User);
    const projectRepo = AppDataSource.getRepository(Project);
    const memberRepo = AppDataSource.getRepository(ProjectMember);
    const reqRepo = AppDataSource.getRepository(Requirement);
    const decRepo = AppDataSource.getRepository(Decision);
    const taskRepo = AppDataSource.getRepository(Task);
    const meetingRepo = AppDataSource.getRepository(Meeting);
    const attendeeRepo = AppDataSource.getRepository(MeetingAttendee);
    const docRepo = AppDataSource.getRepository(Document);
    const auditRepo = AppDataSource.getRepository(AuditLog);

    console.log('Seeding demo users...');
    const defaultPasswordHash = await argon2.hash('Password123!');

    const usersData = [
      {
        email: 'admin@example.com',
        displayName: 'System Admin',
        systemRole: SystemRole.ADMIN,
        professionalRole: ProfessionalRole.PM,
      },
      {
        email: 'alice@example.com',
        displayName: 'Alice Developer',
        systemRole: SystemRole.USER,
        professionalRole: ProfessionalRole.DEVELOPER,
      },
      {
        email: 'bob@example.com',
        displayName: 'Bob QA',
        systemRole: SystemRole.USER,
        professionalRole: ProfessionalRole.QA,
      },
      {
        email: 'charlie@example.com',
        displayName: 'Charlie Infra',
        systemRole: SystemRole.USER,
        professionalRole: ProfessionalRole.INFRASTRUCTURE,
      },
    ];

    const users: Record<string, User> = {};
    for (const u of usersData) {
      let user = await userRepo.findOneBy({ email: u.email });
      if (!user) {
        user = userRepo.create({
          email: u.email,
          displayName: u.displayName,
          passwordHash: defaultPasswordHash,
          systemRole: u.systemRole,
          professionalRole: u.professionalRole,
          isActive: true,
          mustChangePassword: false,
        });
        user = await userRepo.save(user);
      }
      users[u.email] = user;
    }

    const adminUser = users['admin@example.com']!;
    const aliceUser = users['alice@example.com']!;
    const bobUser = users['bob@example.com']!;
    const charlieUser = users['charlie@example.com']!;

    // ── Project 1: Alpha Workspace (AIW) ──────────────────────────────
    console.log('Seeding Project 1: Alpha Workspace (AIW)...');
    let projectA = await projectRepo.findOneBy({ key: 'AIW' });
    if (!projectA) {
      projectA = projectRepo.create({
        key: 'AIW',
        name: 'Alpha Workspace',
        description: 'Primary collaboration workspace for Phase 1 and 2 delivery.',
        status: ProjectStatus.ACTIVE,
        createdBy: aliceUser.id,
      });
      projectA = await projectRepo.save(projectA);
    }

    // Members for Project A
    const projectAMembers = [
      { user: aliceUser, role: ProjectRole.OWNER },
      { user: adminUser, role: ProjectRole.MANAGER },
      { user: bobUser, role: ProjectRole.CONTRIBUTOR },
    ];

    for (const m of projectAMembers) {
      const existing = await memberRepo.findOneBy({ projectId: projectA.id, userId: m.user.id });
      if (!existing) {
        await memberRepo.save(
          memberRepo.create({
            projectId: projectA.id,
            userId: m.user.id,
            accessRole: m.role,
          }),
        );
      }
    }

    // Requirements for Project A
    const req1 = await reqRepo.save(
      reqRepo.create({
        projectId: projectA.id,
        number: 1,
        title: 'User Authentication & Session Management',
        description: 'Implement server-side cookie sessions with Argon2id and CSRF protection.',
        acceptanceCriteria:
          'Users can log in, receive HttpOnly session cookie, and pass CSRF verification.',
        status: RequirementStatus.APPROVED,
        priority: Priority.HIGH,
        createdBy: aliceUser.id,
        updatedBy: aliceUser.id,
      }),
    );

    const req2 = await reqRepo.save(
      reqRepo.create({
        projectId: projectA.id,
        number: 2,
        title: 'Document Storage & File Validation',
        description:
          'Support secure multipart upload with magic byte verification for PDF and DOCX.',
        acceptanceCriteria:
          'Files up to 20 MiB are verified, stored privately, and streaming downloads are secure.',
        status: RequirementStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        createdBy: aliceUser.id,
        updatedBy: aliceUser.id,
      }),
    );

    await reqRepo.save(
      reqRepo.create({
        projectId: projectA.id,
        number: 3,
        title: 'Real-Time Collaboration Investigation',
        description: 'Explore WebSocket / SSE architecture for concurrent updates.',
        acceptanceCriteria: 'Evaluate performance overhead and latency impacts.',
        status: RequirementStatus.DRAFT,
        priority: Priority.LOW,
        createdBy: bobUser.id,
        updatedBy: bobUser.id,
      }),
    );

    // Decisions for Project A
    await decRepo.save(
      decRepo.create({
        projectId: projectA.id,
        number: 1,
        title: 'Adopt NestJS and Modular Monolith Architecture',
        decisionText: 'Build the entire backend as a modular NestJS monolith with PostgreSQL.',
        rationale: 'Simplifies local development and fulfills project architecture guidelines.',
        status: DecisionStatus.ACCEPTED,
        decidedAt: new Date(),
        decidedBy: aliceUser.id,
        createdBy: aliceUser.id,
        updatedBy: aliceUser.id,
      }),
    );

    await decRepo.save(
      decRepo.create({
        projectId: projectA.id,
        number: 2,
        title: 'Use DeepSeek V4 Pro with Separate OpenAI Embeddings',
        decisionText:
          'Configure DeepSeek V4 Pro for LLM generation and text-embedding-3-small for embeddings.',
        rationale: 'Provides high quality reasoning while separating retrieval dependencies.',
        status: DecisionStatus.PROPOSED,
        createdBy: bobUser.id,
        updatedBy: bobUser.id,
      }),
    );

    // Meeting for Project A
    const meetingA = await meetingRepo.save(
      meetingRepo.create({
        projectId: projectA.id,
        title: 'Sprint Planning & Architecture Kickoff',
        startsAt: new Date(Date.now() - 3600000 * 24),
        endsAt: new Date(Date.now() - 3600000 * 23),
        agenda: 'Review Phase 1 scope and assign initial tasks.',
        notes:
          'Agreed that all Phase 1 core CRUD operations must be completed before starting Phase 2 AI workers.',
        transcriptText:
          'Alice: Let us complete Milestone P1-06 and P1-07 today. Bob: Sounds great!',
        transcriptVersion: 1,
        summary: 'Team aligned on completing Phase 1 quality gates and release readiness.',
        createdBy: aliceUser.id,
        updatedBy: aliceUser.id,
      }),
    );

    await attendeeRepo.save([
      attendeeRepo.create({ meetingId: meetingA.id, userId: aliceUser.id }),
      attendeeRepo.create({ meetingId: meetingA.id, userId: bobUser.id }),
    ]);

    // Tasks for Project A
    await taskRepo.save([
      taskRepo.create({
        projectId: projectA.id,
        number: 1,
        title: 'Configure Argon2id password hashing',
        description: 'Integrate Argon2 with salt and verify login credentials.',
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        assigneeId: aliceUser.id,
        requirementId: req1.id,
        sourceMeetingId: meetingA.id,
        createdBy: aliceUser.id,
        updatedBy: aliceUser.id,
      }),
      taskRepo.create({
        projectId: projectA.id,
        number: 2,
        title: 'Implement LocalStorageService driver',
        description: 'Store files in ./var/uploads with path traversal protection.',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        assigneeId: aliceUser.id,
        requirementId: req2.id,
        sourceMeetingId: meetingA.id,
        createdBy: aliceUser.id,
        updatedBy: aliceUser.id,
      }),
      taskRepo.create({
        projectId: projectA.id,
        number: 3,
        title: 'Setup PostgreSQL pgvector and database migrations',
        description: 'Create initial database schema with TypeORM migrations.',
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        assigneeId: bobUser.id,
        requirementId: req1.id,
        createdBy: bobUser.id,
        updatedBy: bobUser.id,
      }),
      taskRepo.create({
        projectId: projectA.id,
        number: 4,
        title: 'Implement Dashboard and Search integration',
        description: 'Aggregate task progress and enable unified multi-entity keyword search.',
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        assigneeId: aliceUser.id,
        requirementId: req1.id,
        createdBy: aliceUser.id,
        updatedBy: aliceUser.id,
      }),
      taskRepo.create({
        projectId: projectA.id,
        number: 5,
        title: 'Fix overdue security dependency update',
        description: 'Update critical vulnerabilities in dependencies.',
        status: TaskStatus.TODO,
        priority: Priority.URGENT,
        assigneeId: aliceUser.id,
        dueDate: '2020-01-01', // Explicitly overdue
        createdBy: aliceUser.id,
        updatedBy: aliceUser.id,
      }),
    ]);

    // Documents for Project A
    await docRepo.save([
      docRepo.create({
        projectId: projectA.id,
        title: 'System Architecture Document',
        description: 'Detailed modular monolith architecture overview.',
        originalFilename: 'architecture.pdf',
        storageKey: 'projects/aiw/architecture.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1048576,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        revision: 1,
        processingStatus: ProcessingStatus.PENDING,
        createdBy: aliceUser.id,
        updatedBy: aliceUser.id,
      }),
      docRepo.create({
        projectId: projectA.id,
        title: 'REST API Specification',
        description: 'Endpoints and data transfer objects for all Phase 1 features.',
        originalFilename: 'api-spec.md',
        storageKey: 'projects/aiw/api-spec.md',
        mimeType: 'text/markdown',
        sizeBytes: 8192,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        revision: 1,
        processingStatus: ProcessingStatus.COMPLETED,
        createdBy: bobUser.id,
        updatedBy: bobUser.id,
      }),
    ]);

    // Audit logs for Project A
    await auditRepo.save([
      auditRepo.create({
        projectId: projectA.id,
        actorId: aliceUser.id,
        action: 'PROJECT_CREATED',
        entityType: 'PROJECT',
        entityId: projectA.id,
        metadata: { name: projectA.name, key: projectA.key },
      }),
      auditRepo.create({
        projectId: projectA.id,
        actorId: aliceUser.id,
        action: 'CREATE_REQUIREMENT',
        entityType: 'REQUIREMENT',
        entityId: req1.id,
        metadata: { number: 1, title: req1.title },
      }),
      auditRepo.create({
        projectId: projectA.id,
        actorId: bobUser.id,
        action: 'CREATE_TASK',
        entityType: 'TASK',
        metadata: { number: 3, title: 'Setup PostgreSQL pgvector' },
      }),
    ]);

    // ── Project 2: Beta Security Workspace (SEC) ─────────────────────
    console.log('Seeding Project 2: Beta Security Workspace (SEC)...');
    let projectB = await projectRepo.findOneBy({ key: 'SEC' });
    if (!projectB) {
      projectB = projectRepo.create({
        key: 'SEC',
        name: 'Beta Security Workspace',
        description: 'Isolated security project for cross-project permission tests.',
        status: ProjectStatus.ACTIVE,
        createdBy: charlieUser.id,
      });
      projectB = await projectRepo.save(projectB);
    }

    const projectBMembers = [{ user: charlieUser, role: ProjectRole.OWNER }];

    for (const m of projectBMembers) {
      const existing = await memberRepo.findOneBy({ projectId: projectB.id, userId: m.user.id });
      if (!existing) {
        await memberRepo.save(
          memberRepo.create({
            projectId: projectB.id,
            userId: m.user.id,
            accessRole: m.role,
          }),
        );
      }
    }

    await reqRepo.save(
      reqRepo.create({
        projectId: projectB.id,
        number: 1,
        title: 'Strict Network Isolation & TLS 1.3',
        description: 'Ensure isolated subnets and encrypted in-transit communications.',
        status: RequirementStatus.APPROVED,
        priority: Priority.URGENT,
        createdBy: charlieUser.id,
        updatedBy: charlieUser.id,
      }),
    );

    await taskRepo.save(
      taskRepo.create({
        projectId: projectB.id,
        number: 1,
        title: 'Audit infrastructure security groups',
        description: 'Verify only port 3000 and 5432 are accessible internally.',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        assigneeId: charlieUser.id,
        createdBy: charlieUser.id,
        updatedBy: charlieUser.id,
      }),
    );

    await auditRepo.save(
      auditRepo.create({
        projectId: projectB.id,
        actorId: charlieUser.id,
        action: 'PROJECT_CREATED',
        entityType: 'PROJECT',
        entityId: projectB.id,
        metadata: { name: projectB.name, key: projectB.key },
      }),
    );

    console.log('✅ Seeding completed successfully!');
    console.log('Seed Summary:');
    console.log(
      '- Users: admin@example.com, alice@example.com, bob@example.com, charlie@example.com (Password: Password123!)',
    );
    console.log('- Projects: AIW (Alpha Workspace), SEC (Beta Security Workspace)');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
