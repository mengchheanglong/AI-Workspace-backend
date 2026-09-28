const { Client } = require('pg');

const client = new Client({
  connectionString:
    'postgresql://ai_workspace_test:local_test_only@127.0.0.1:55433/ai_workspace_test',
});

const PROJECTS = {
  AIW: 'a1415aad-9b10-4410-a57f-dc9d04b70960', // AI Project Workspace
  COR: '5c90fbf5-b1ff-4ff5-b1e6-f93eccec246a', // Client Onboarding Revamp
  ISG: '1b444400-fa7c-41c2-a1fa-75d9eec63979', // Internal Style Guide
};

const USERS = {
  panhavorn: '24f5bd2f-7efd-4d71-824b-31e426404c46',
  mengfong: '7531a6fd-1b7c-4d61-8427-e39882f62687',
  mengchheang: '2dde963a-c0ca-4f64-8f82-46782c8e24f9',
  john: '872e561f-772e-412f-a04a-90237eb0aaeb',
};

// 15 canonical requirements matching user mockup:
// 3 Draft, 3 In Review, 9 Approved
const REQUIREMENTS = [
  {
    project: PROJECTS.AIW,
    number: 1,
    title: 'Auth must support email/password with hashed sessions',
    description:
      'Provide secure authentication with argon2id hashing, HttpOnly SameSite=Lax cookies, and Redis session invalidation on logout.',
    acceptanceCriteria:
      'Given valid credentials, when POST /api/v1/auth/login, then a secure cookie and CSRF token are returned.',
    status: 'APPROVED',
    priority: 'HIGH', // Must-have
    updater: USERS.panhavorn,
    hoursAgo: 2,
  },
  {
    project: PROJECTS.AIW,
    number: 2,
    title: 'Dashboard must surface project overview and task stats',
    description:
      'Display total progress rate, overdue tasks in Bangkok timezone, and recent audit activity stream for active projects.',
    acceptanceCriteria:
      'Dashboard API aggregates active task counts, completion rate, and latest 10 activity log entries.',
    status: 'IN_REVIEW',
    priority: 'MEDIUM', // Should-have
    updater: USERS.mengfong,
    hoursAgo: 4,
  },
  {
    project: PROJECTS.COR,
    number: 3,
    title: 'Intake form must validate email and phone fields',
    description:
      'Validate client contact inputs with E.164 phone formats and standard RFC 5322 email regex before persistence.',
    acceptanceCriteria:
      'Form displays inline field-level validation errors upon invalid user submission.',
    status: 'DRAFT',
    priority: 'MEDIUM', // Should-have
    updater: USERS.mengchheang,
    hoursAgo: 24, // Yesterday
  },
  {
    project: PROJECTS.COR,
    number: 4,
    title: 'Client dashboard must show onboarding progress',
    description:
      'A progress bar indicating completed onboarding milestones and outstanding documentation uploads.',
    acceptanceCriteria:
      'Percentage completed dynamically calculates based on verified checklist items.',
    status: 'IN_REVIEW',
    priority: 'MEDIUM', // Should-have
    updater: USERS.mengfong,
    hoursAgo: 5,
  },
  {
    project: PROJECTS.AIW,
    number: 5,
    title: 'Requirements must support create/view/update/delete/search',
    description:
      'Full CRUD with optimistic locking via version column, soft delete, and full-text PostgreSQL search.',
    acceptanceCriteria:
      'All mutation endpoints enforce project scope, active membership, and conflict detection.',
    status: 'APPROVED',
    priority: 'HIGH', // Must-have
    updater: USERS.john,
    hoursAgo: 24, // 1d ago
  },
  {
    project: PROJECTS.COR,
    number: 6,
    title: 'SSO login must be supported for enterprise clients',
    description: 'Enable SAML 2.0 and OIDC identity federation for enterprise workspace tenants.',
    acceptanceCriteria:
      'Users can initiate SSO from custom tenant login slug and receive verified JWT/session.',
    status: 'IN_REVIEW',
    priority: 'HIGH', // Must-have
    updater: USERS.mengchheang,
    hoursAgo: 24, // Yesterday
  },
  {
    project: PROJECTS.ISG,
    number: 7,
    title: 'Style tokens must match the brand color system',
    description:
      'Define semantic Tailwind and CSS variables for primary blue, orange accent, and dark sidebar hues.',
    acceptanceCriteria: 'Design tokens pass WCAG AA contrast ratio across dark and light modes.',
    status: 'APPROVED',
    priority: 'MEDIUM', // Should-have
    updater: USERS.panhavorn,
    hoursAgo: 48, // 2d ago
  },
  {
    project: PROJECTS.AIW,
    number: 8,
    title: 'Documents must support upload, view, and search',
    description:
      'Allow multi-part file uploads (PDF, DOCX, TXT) with SHA-256 checksums and streaming download verification.',
    acceptanceCriteria:
      'Uploaded files are securely scoped by project ID and verifiable by cryptographic hash.',
    status: 'APPROVED',
    priority: 'HIGH', // Must-have
    updater: USERS.mengchheang,
    hoursAgo: 48, // 2d ago
  },
  {
    project: PROJECTS.COR,
    number: 9,
    title: 'System must send a confirmation email after signup',
    description:
      'Transactional email notification with a 24-hour verification token sent via SMTP/SendGrid.',
    acceptanceCriteria:
      'Unverified accounts are barred from sensitive workspace mutations until token confirmation.',
    status: 'APPROVED',
    priority: 'HIGH', // Must-have
    updater: USERS.panhavorn,
    hoursAgo: 48, // 2d ago
  },
  {
    project: PROJECTS.AIW,
    number: 10,
    title: 'Role-based access must restrict project data by membership',
    description:
      'Enforce OWNER, MANAGER, CONTRIBUTOR, and VIEWER roles across all project resource endpoints.',
    acceptanceCriteria:
      'Cross-project data leaks return 403 Forbidden with standard code responses.',
    status: 'APPROVED',
    priority: 'HIGH', // Must-have
    updater: USERS.panhavorn,
    hoursAgo: 72, // 3d ago
  },
  {
    project: PROJECTS.COR,
    number: 11,
    title: 'Client status tracker must show step-by-step stages',
    description:
      'Interactive stage indicator with steps: Invited, KYC Submitted, Under Review, Active.',
    acceptanceCriteria:
      'Stage changes emit audit log entries and notify assigned account managers.',
    status: 'APPROVED',
    priority: 'MEDIUM', // Should-have
    updater: USERS.mengfong,
    hoursAgo: 72, // 3d ago
  },
  {
    project: PROJECTS.ISG,
    number: 12,
    title: 'Typography scale must define at least 6 sizes',
    description:
      'Harmonious modular type scale: xs (11px), sm (12px), base (13px), md (14px), lg (18px), xl (24px).',
    acceptanceCriteria:
      'Scale integrated into Tailwind theme config with strict responsive font-size tokens.',
    status: 'APPROVED',
    priority: 'MEDIUM', // Should-have
    updater: USERS.mengchheang,
    hoursAgo: 72, // 3d ago
  },
  {
    project: PROJECTS.AIW,
    number: 13,
    title: 'Audit logging must record important AI and system actions',
    description:
      'Append-only audit trail logging user mutations, proposal approvals, and security alerts.',
    acceptanceCriteria: 'Audit logs cannot be updated or deleted by normal project members.',
    status: 'DRAFT',
    priority: 'LOW', // Could-have
    updater: USERS.mengfong,
    hoursAgo: 96, // 4d ago
  },
  {
    project: PROJECTS.ISG,
    number: 14,
    title: 'Icon set must use a consistent stroke width',
    description:
      'Standardize on Lucide React with 1.75 stroke width and consistent 14px/16px/20px sizing.',
    acceptanceCriteria: 'All navigation and button icons use unified stroke and color tokens.',
    status: 'APPROVED',
    priority: 'LOW', // Could-have
    updater: USERS.panhavorn,
    hoursAgo: 96, // 4d ago
  },
  {
    project: PROJECTS.ISG,
    number: 15,
    title: 'Component spacing tokens must follow an 8px grid',
    description:
      'Consistent layout padding, margins, card gaps, and button heights adhering to 8pt design system.',
    acceptanceCriteria: 'All UI components verified for 4px/8px alignment in Figma and code.',
    status: 'DRAFT',
    priority: 'MEDIUM', // Should-have
    updater: USERS.john,
    hoursAgo: 120, // 5d ago
  },
];

async function seed() {
  await client.connect();
  console.log('Connected to test DB.');

  // Clean existing requirements & revisions
  await client.query('DELETE FROM requirement_revisions');
  // Nullify any task foreign keys to requirements
  await client.query('UPDATE tasks SET requirement_id = NULL');
  await client.query('DELETE FROM requirements');

  console.log('Inserting 15 canonical requirements...');
  const now = Date.now();

  for (const req of REQUIREMENTS) {
    const updatedAt = new Date(now - req.hoursAgo * 3600 * 1000);
    const createdAt = new Date(now - (req.hoursAgo + 12) * 3600 * 1000);

    const res = await client.query(
      `INSERT INTO requirements (
        project_id, number, title, description, acceptance_criteria, status, priority, created_by, updated_by, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        req.project,
        req.number,
        req.title,
        req.description,
        req.acceptanceCriteria,
        req.status,
        req.priority,
        req.updater,
        req.updater,
        1,
        createdAt,
        updatedAt,
      ],
    );

    // Also add an initial revision record
    await client.query(
      `INSERT INTO requirement_revisions (
        requirement_id, version, title, description, acceptance_criteria, status, priority, changed_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        res.rows[0].id,
        1,
        req.title,
        req.description,
        req.acceptanceCriteria,
        req.status,
        req.priority,
        req.updater,
        updatedAt,
      ],
    );
  }

  const countsRes = await client.query('SELECT status, count(*) FROM requirements GROUP BY status');
  console.log('Seeded requirements counts:', countsRes.rows);

  const totalRes = await client.query('SELECT count(*) FROM requirements');
  console.log('Total requirements:', totalRes.rows[0].count);

  await client.end();
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
