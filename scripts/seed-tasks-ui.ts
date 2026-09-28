import 'reflect-metadata';
import * as argon2 from 'argon2';
import AppDataSource from '../src/database/data-source';
import { User, SystemRole, ProfessionalRole } from '../src/modules/users/entities/user.entity';
import { Project, ProjectStatus } from '../src/modules/projects/entities/project.entity';
import { ProjectMember, ProjectRole } from '../src/modules/projects/entities/project-member.entity';
import { Task, TaskStatus, Priority } from '../src/modules/tasks/entities/task.entity';

async function seedTasksUI() {
  console.log('Connecting to database for Tasks UI seeding...');
  await AppDataSource.initialize();

  try {
    const userRepo = AppDataSource.getRepository(User);
    const projectRepo = AppDataSource.getRepository(Project);
    const memberRepo = AppDataSource.getRepository(ProjectMember);
    const taskRepo = AppDataSource.getRepository(Task);

    const defaultPasswordHash = await argon2.hash('Password123!');

    const usersData = [
      { email: 'admin@example.com', displayName: 'System Admin', role: ProfessionalRole.PM },
      { email: 'panhavorn@example.com', displayName: 'Panhavorn', role: ProfessionalRole.DEVELOPER },
      { email: 'mengfong@example.com', displayName: 'Meng Fong', role: ProfessionalRole.DEVELOPER },
      { email: 'mengchheang@example.com', displayName: 'Mengchheang', role: ProfessionalRole.DEVELOPER },
      { email: 'john@example.com', displayName: 'John Smith', role: ProfessionalRole.QA },
      { email: 'jane@example.com', displayName: 'Jane Doe', role: ProfessionalRole.DX },
    ];

    const users: Record<string, User> = {};
    for (const u of usersData) {
      let user = await userRepo.findOneBy({ email: u.email });
      if (!user) {
        user = userRepo.create({
          email: u.email,
          displayName: u.displayName,
          passwordHash: defaultPasswordHash,
          systemRole: u.email === 'admin@example.com' ? SystemRole.ADMIN : SystemRole.USER,
          professionalRole: u.role,
          isActive: true,
          mustChangePassword: false,
        });
        user = await userRepo.save(user);
      }
      users[u.email] = user;
    }

    const admin = users['admin@example.com']!;
    const panhavorn = users['panhavorn@example.com']!;
    const mengfong = users['mengfong@example.com']!;
    const mengchheang = users['mengchheang@example.com']!;
    const john = users['john@example.com']!;
    const jane = users['jane@example.com']!;

    // ── Projects ───────────────────────────────────────────────────────────
    const projectsData = [
      { key: 'AIW', name: 'AI Project Workspace', desc: 'Primary collaboration workspace for AI system delivery' },
      { key: 'COR', name: 'Client Onboarding Revamp', desc: 'Streamline customer intake and onboarding workflows' },
      { key: 'ISG', name: 'Internal Style Guide', desc: 'Design system, component tokens, and accessibility specs' },
    ];

    const projects: Record<string, Project> = {};
    for (const p of projectsData) {
      let proj = await projectRepo.findOneBy({ key: p.key });
      if (!proj) {
        proj = projectRepo.create({
          key: p.key,
          name: p.name,
          description: p.desc,
          status: ProjectStatus.ACTIVE,
          createdBy: admin.id,
        });
        proj = await projectRepo.save(proj);
      } else if (proj.name !== p.name) {
        proj.name = p.name;
        proj = await projectRepo.save(proj);
      }
      projects[p.key] = proj;

      // Add all users as project members so queries succeed
      for (const u of Object.values(users)) {
        const existingMember = await memberRepo.findOneBy({ projectId: proj.id, userId: u.id });
        if (!existingMember) {
          await memberRepo.save(
            memberRepo.create({
              projectId: proj.id,
              userId: u.id,
              accessRole: u.id === admin.id ? ProjectRole.OWNER : ProjectRole.CONTRIBUTOR,
            }),
          );
        }
      }
    }

    const aiw = projects['AIW']!;
    const cor = projects['COR']!;
    const isg = projects['ISG']!;

    // Clean existing tasks
    await taskRepo.createQueryBuilder().delete().from(Task).where('projectId IN (:...ids)', {
      ids: [aiw.id, cor.id, isg.id],
    }).execute();

    // ── 31 Exact Tasks matching reference designs ───────────────────────────
    const allTasks = [
      // 1. In Progress tasks (6)
      {
        project: aiw,
        title: 'Design database schema & migrations',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        dueDate: '2026-09-18', // Overdue
        assignee: panhavorn,
      },
      {
        project: aiw,
        title: 'Build dashboard shell + integration',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        dueDate: '2026-09-19',
        assignee: mengfong,
      },
      {
        project: cor,
        title: 'Build client intake form UI',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        dueDate: '2026-09-23',
        assignee: mengchheang,
      },
      {
        project: isg,
        title: 'Audit color contrast ratios',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-24',
        assignee: panhavorn,
      },
      {
        project: aiw,
        title: 'Build requirements CRUD API',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        dueDate: '2026-09-21',
        assignee: john,
      },
      {
        project: cor,
        title: 'Wireframe client status tracker',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-22',
        assignee: jane,
      },

      // 2. To Do tasks (8)
      {
        project: aiw,
        title: 'Set up in-app notification service',
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-20',
        assignee: panhavorn,
      },
      {
        project: aiw,
        title: 'Design meetings & decisions UI',
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-22',
        assignee: panhavorn,
      },
      {
        project: cor,
        title: 'Draft client intake form fields',
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        dueDate: '2026-09-21',
        assignee: jane,
      },
      {
        project: isg,
        title: 'Define component spacing tokens',
        status: TaskStatus.TODO,
        priority: Priority.LOW,
        dueDate: '2026-09-25',
        assignee: panhavorn,
      },
      {
        project: aiw,
        title: 'Plan document versioning approach',
        status: TaskStatus.TODO,
        priority: Priority.LOW,
        dueDate: '2026-09-26',
        assignee: mengchheang,
      },
      {
        project: cor,
        title: 'Write onboarding email copy',
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-27',
        assignee: john,
      },
      {
        project: isg,
        title: 'Catalog icon set for style guide',
        status: TaskStatus.TODO,
        priority: Priority.LOW,
        dueDate: '2026-09-28',
        assignee: mengfong,
      },
      {
        project: aiw,
        title: 'Draft permissions matrix for roles',
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        dueDate: '2026-09-23',
        assignee: john,
      },

      // 3. Blocked tasks (2)
      {
        project: aiw,
        title: 'Integrate OAuth providers',
        status: TaskStatus.BLOCKED,
        priority: Priority.HIGH,
        dueDate: null,
        assignee: mengfong,
        blockedReason: 'Waiting on Phase 2 scope decision',
      },
      {
        project: cor,
        title: 'Confirm client SSO requirements',
        status: TaskStatus.BLOCKED,
        priority: Priority.MEDIUM,
        dueDate: null,
        assignee: john,
        blockedReason: 'Waiting on client legal review',
      },

      // 4. Done tasks (15)
      {
        project: aiw,
        title: 'Implement auth API (email/password)',
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        dueDate: '2026-09-10',
        assignee: panhavorn,
      },
      {
        project: aiw,
        title: 'Build login/register screens',
        status: TaskStatus.DONE,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-12',
        assignee: mengchheang,
      },
      {
        project: isg,
        title: 'Finalize color palette',
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        dueDate: '2026-09-11',
        assignee: mengfong,
      },
      {
        project: aiw,
        title: 'Confirm backend framework choice',
        status: TaskStatus.DONE,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-08',
        assignee: jane,
      },
      {
        project: aiw,
        title: 'Draft SRS document',
        status: TaskStatus.DONE,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-09',
        assignee: john,
      },
      {
        project: aiw,
        title: 'Design ER diagram',
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        dueDate: '2026-09-11',
        assignee: panhavorn,
      },
      {
        project: aiw,
        title: 'Set up CI pipeline',
        status: TaskStatus.DONE,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-13',
        assignee: mengfong,
      },
      {
        project: aiw,
        title: 'Design auth screens (Figma)',
        status: TaskStatus.DONE,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-14',
        assignee: mengchheang,
      },
      {
        project: aiw,
        title: 'Build forgot-password flow UI',
        status: TaskStatus.DONE,
        priority: Priority.LOW,
        dueDate: '2026-09-15',
        assignee: john,
      },
      {
        project: cor,
        title: 'Kickoff call with client',
        status: TaskStatus.DONE,
        priority: Priority.LOW,
        dueDate: '2026-09-05',
        assignee: jane,
      },
      {
        project: cor,
        title: 'Collect client brand assets',
        status: TaskStatus.DONE,
        priority: Priority.LOW,
        dueDate: '2026-09-06',
        assignee: mengfong,
      },
      {
        project: isg,
        title: 'Choose typography pairing',
        status: TaskStatus.DONE,
        priority: Priority.LOW,
        dueDate: '2026-09-07',
        assignee: mengchheang,
      },
      {
        project: isg,
        title: 'Set up Style Guide repo',
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        dueDate: '2026-09-04',
        assignee: panhavorn,
      },
      {
        project: aiw,
        title: 'Draft dashboard wireframes',
        status: TaskStatus.DONE,
        priority: Priority.MEDIUM,
        dueDate: '2026-09-16',
        assignee: panhavorn,
      },
      {
        project: aiw,
        title: 'Scaffold Next.js + Express repo',
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        dueDate: '2026-09-03',
        assignee: mengchheang,
      },
    ];

    let numberCounters: Record<string, number> = {};
    for (const t of allTasks) {
      const projId = t.project.id;
      numberCounters[projId] = (numberCounters[projId] ?? 0) + 1;
      const num = numberCounters[projId];

      const entity = taskRepo.create({
        projectId: projId,
        number: num,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        assigneeId: t.assignee.id,
        blockedReason: (t as any).blockedReason ?? null,
        createdBy: admin.id,
        updatedBy: admin.id,
        version: 1,
      });
      await taskRepo.save(entity);
    }

    console.log(`✅ Successfully seeded ${allTasks.length} tasks across 3 active projects!`);
    console.log('Project breakdown:');
    console.log(`- AI Project Workspace (AIW): ${allTasks.filter(t => t.project.key === 'AIW').length} tasks`);
    console.log(`- Client Onboarding Revamp (COR): ${allTasks.filter(t => t.project.key === 'COR').length} tasks`);
    console.log(`- Internal Style Guide (ISG): ${allTasks.filter(t => t.project.key === 'ISG').length} tasks`);
    console.log('Status breakdown:');
    console.log(`- TO DO: ${allTasks.filter(t => t.status === TaskStatus.TODO).length}`);
    console.log(`- IN PROGRESS: ${allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length}`);
    console.log(`- DONE: ${allTasks.filter(t => t.status === TaskStatus.DONE).length}`);
    console.log(`- BLOCKED: ${allTasks.filter(t => t.status === TaskStatus.BLOCKED).length}`);
  } finally {
    await AppDataSource.destroy();
  }
}

seedTasksUI().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
