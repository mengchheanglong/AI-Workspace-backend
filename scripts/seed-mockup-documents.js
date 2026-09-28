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
  john: '872e561f-772e-412f-a04a-90237eb0aaeb',
  jane: 'ce3b249f-b1b4-4733-a0c0-3790620c70ab',
  alice: '8ca4217d-d550-40ba-948d-01206d5b1fc0',
};

const now = Date.now();
const hours = (h) => new Date(now - h * 3600 * 1000);
const days = (d) => new Date(now - d * 24 * 3600 * 1000);

const DOCUMENTS = [
  {
    id: 'd1000001-0000-0000-0000-000000000001',
    projectId: PROJECTS.AIW,
    title: 'SRS_v1.0.pdf',
    originalFilename: 'SRS_v1.0.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2516582, // 2.4 MB
    createdBy: USERS.panhavorn,
    createdAt: hours(1),
  },
  {
    id: 'd1000001-0000-0000-0000-000000000002',
    projectId: PROJECTS.AIW,
    title: 'ER-Diagram.png',
    originalFilename: 'ER-Diagram.png',
    mimeType: 'image/png',
    sizeBytes: 880640, // 860 KB
    createdBy: USERS.john,
    createdAt: hours(3),
  },
  {
    id: 'd1000001-0000-0000-0000-000000000003',
    projectId: PROJECTS.AIW,
    title: 'Meeting-Notes-Sep14.docx',
    originalFilename: 'Meeting-Notes-Sep14.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 98304, // 96 KB
    createdBy: USERS.mengfong,
    createdAt: hours(6),
  },
  {
    id: 'd1000001-0000-0000-0000-000000000004',
    projectId: PROJECTS.COR,
    title: 'Client-Brief.docx',
    originalFilename: 'Client-Brief.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 348160, // 340 KB
    createdBy: USERS.mengfong,
    createdAt: days(1),
  },
  {
    id: 'd1000001-0000-0000-0000-000000000005',
    projectId: PROJECTS.ISG,
    title: 'Style-Tokens.xlsx',
    originalFilename: 'Style-Tokens.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 131072, // 128 KB
    createdBy: USERS.mengfong,
    createdAt: days(2),
  },
  {
    id: 'd1000001-0000-0000-0000-000000000006',
    projectId: PROJECTS.COR,
    title: 'Onboarding-Flow-Wireframes.png',
    originalFilename: 'Onboarding-Flow-Wireframes.png',
    mimeType: 'image/png',
    sizeBytes: 2097152, // 2.0 MB
    createdBy: USERS.panhavorn,
    createdAt: days(3),
  },
  {
    id: 'd1000001-0000-0000-0000-000000000007',
    projectId: PROJECTS.AIW,
    title: 'Architecture-Diagram.pdf',
    originalFilename: 'Architecture-Diagram.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1153434, // 1.1 MB
    createdBy: USERS.jane,
    createdAt: days(4),
  },
  {
    id: 'd1000001-0000-0000-0000-000000000008',
    projectId: PROJECTS.ISG,
    title: 'Component-Library.pptx',
    originalFilename: 'Component-Library.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    sizeBytes: 3565158, // 3.4 MB
    createdBy: USERS.john,
    createdAt: days(5),
  },
];

async function seed() {
  await client.connect();
  console.log('Connected to database.');

  // Clean existing documents
  await client.query('DELETE FROM document_revisions');
  await client.query('DELETE FROM documents');

  console.log(`Inserting ${DOCUMENTS.length} canonical documents...`);

  // Insert the 8 canonical documents
  for (const doc of DOCUMENTS) {
    const storageKey = `projects/${doc.projectId}/documents/${doc.id}-rev1-${doc.originalFilename}`;
    const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    await client.query(
      `INSERT INTO documents (
         id, project_id, title, description, original_filename,
         storage_key, mime_type, size_bytes, sha256, revision,
         processing_status, created_by, updated_by, version,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14,
         $15, $15
       ) ON CONFLICT (id) DO UPDATE SET
         title = $3, original_filename = $5, size_bytes = $8,
         created_by = $12, updated_by = $13, created_at = $15`,
      [
        doc.id,
        doc.projectId,
        doc.title,
        `Document for ${doc.title}`,
        doc.originalFilename,
        storageKey,
        doc.mimeType,
        doc.sizeBytes,
        sha256,
        1,
        'COMPLETED',
        doc.createdBy,
        doc.createdBy,
        1,
        doc.createdAt,
      ],
    );
  }

  console.log(`Seeded ${DOCUMENTS.length} canonical documents successfully.`);
  await client.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
