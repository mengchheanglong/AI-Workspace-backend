import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { DocumentsService } from '../../src/modules/documents/documents.service';
import { Document, ProcessingStatus } from '../../src/modules/documents/entities/document.entity';
import { DocumentRevision } from '../../src/modules/documents/entities/document-revision.entity';
import {
  ProjectMember,
  ProjectRole,
} from '../../src/modules/projects/entities/project-member.entity';
import { STORAGE_DRIVER, StorageDriver } from '../../src/modules/storage/storage.interface';
import { AuditService } from '../../src/modules/audit/audit.service';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';
const ACTOR_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_USER = '33333333-3333-3333-3333-333333333333';
const DOC_ID = '44444444-4444-4444-4444-444444444444';

function makeDocument(overrides: Partial<Document> = {}): Document {
  const now = new Date();
  return {
    id: DOC_ID,
    projectId: PROJECT_ID,
    title: 'Test Document',
    description: 'Document description',
    originalFilename: 'test.pdf',
    storageKey: `projects/${PROJECT_ID}/documents/${DOC_ID}-rev1-abcdef.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    sha256: 'a'.repeat(64),
    revision: 1,
    processingStatus: ProcessingStatus.PENDING,
    lastErrorCode: null,
    createdBy: ACTOR_ID,
    updatedBy: ACTOR_ID,
    version: 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Document;
}

function makeRevision(overrides: Partial<DocumentRevision> = {}): DocumentRevision {
  const now = new Date();
  return {
    id: '55555555-5555-5555-5555-555555555555',
    documentId: DOC_ID,
    revision: 1,
    originalFilename: 'test.pdf',
    storageKey: `projects/${PROJECT_ID}/documents/${DOC_ID}-rev1-abcdef.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    sha256: 'a'.repeat(64),
    changedBy: ACTOR_ID,
    createdAt: now,
    ...overrides,
  } as DocumentRevision;
}

function makeMulterFile(
  originalname: string,
  buffer: Buffer,
  mimetype = 'application/octet-stream',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: originalname,
    path: '',
    stream: Readable.from(buffer),
  };
}

describe('DocumentsService', () => {
  let service: DocumentsService;
  let mockStorageDriver: jest.Mocked<StorageDriver>;
  let mockAuditService: { record: jest.Mock; listForProject: jest.Mock };

  const mockDocRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockRevRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(20971520),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockStorageDriver = {
      save: jest.fn().mockResolvedValue({ sizeBytes: 1024, sha256: 'e'.repeat(64) }),
      getStream: jest.fn().mockResolvedValue(Readable.from(Buffer.from('file-content'))),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
      getAbsolutePath: jest.fn().mockReturnValue('/var/uploads/test'),
    };

    mockAuditService = {
      record: jest.fn().mockResolvedValue({}),
      listForProject: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: getRepositoryToken(Document), useValue: mockDocRepo },
        { provide: getRepositoryToken(DocumentRevision), useValue: mockRevRepo },
        { provide: getRepositoryToken(ProjectMember), useValue: mockMemberRepo },
        { provide: STORAGE_DRIVER, useValue: mockStorageDriver },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe('validateFile', () => {
    it('throws BadRequestException if file is missing', async () => {
      await expect(service.validateFile(undefined)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if file size is zero', async () => {
      const file = makeMulterFile('test.pdf', Buffer.alloc(0));
      await expect(service.validateFile(file)).rejects.toThrow(BadRequestException);
    });

    it('throws PayloadTooLargeException if file exceeds max size', async () => {
      const file = makeMulterFile('test.pdf', Buffer.alloc(10));
      file.size = 25 * 1024 * 1024; // 25 MiB
      await expect(service.validateFile(file)).rejects.toThrow(PayloadTooLargeException);
    });

    it('throws UnsupportedMediaTypeException for unsupported extensions', async () => {
      const file = makeMulterFile('evil.exe', Buffer.from('MZ...'));
      await expect(service.validateFile(file)).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('rejects PDF file with invalid magic bytes', async () => {
      const file = makeMulterFile('corrupt.pdf', Buffer.from('NOT_A_PDF_FILE'));
      await expect(service.validateFile(file)).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('accepts valid PDF with %PDF- header', async () => {
      const pdfHeader = Buffer.from('%PDF-1.7 valid content');
      const file = makeMulterFile('doc.pdf', pdfHeader);
      const result = await service.validateFile(file);
      expect(result.ext).toBe('.pdf');
      expect(result.detectedMime).toBe('application/pdf');
    });

    it('rejects DOCX file with invalid magic bytes', async () => {
      const file = makeMulterFile('corrupt.docx', Buffer.from('NOT_A_DOCX_FILE'));
      await expect(service.validateFile(file)).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('accepts valid DOCX with PK signature', async () => {
      const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      const file = makeMulterFile('notes.docx', docxHeader);
      const result = await service.validateFile(file);
      expect(result.ext).toBe('.docx');
      expect(result.detectedMime).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('rejects TXT file containing binary null bytes', async () => {
      const binaryText = Buffer.from('hello\x00world');
      const file = makeMulterFile('plain.txt', binaryText);
      await expect(service.validateFile(file)).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('accepts valid UTF-8 text file and markdown file', async () => {
      const validText = Buffer.from('Hello, UTF-8 text file!');
      const txtFile = makeMulterFile('hello.txt', validText);
      const txtRes = await service.validateFile(txtFile);
      expect(txtRes.detectedMime).toBe('text/plain');

      const mdFile = makeMulterFile('readme.md', Buffer.from('# Readme\n\nContent'));
      const mdRes = await service.validateFile(mdFile);
      expect(mdRes.detectedMime).toBe('text/markdown');
    });
  });

  describe('upload', () => {
    it('uploads a document, creates revision 1, and records audit log', async () => {
      const file = makeMulterFile('spec.pdf', Buffer.from('%PDF-1.4 file content'));
      const docEntity = makeDocument({ title: 'Spec Title' });

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const manager = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === Document) {
              return {
                create: jest.fn().mockReturnValue(docEntity),
                save: jest.fn().mockResolvedValue(docEntity),
              };
            }
            if (entity === DocumentRevision) {
              return {
                create: jest.fn().mockReturnValue(makeRevision()),
                save: jest.fn().mockResolvedValue(makeRevision()),
              };
            }
          }),
        };
        return cb(manager);
      });

      const result = await service.upload(PROJECT_ID, ACTOR_ID, file, {
        title: 'Spec Title',
        description: 'Spec description',
      });

      expect(result.id).toBe(DOC_ID);
      expect(mockStorageDriver.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DOCUMENT_UPLOADED',
          entityType: 'DOCUMENT',
          entityId: DOC_ID,
        }),
      );
    });

    it('compensates by deleting stored file if database transaction fails', async () => {
      const file = makeMulterFile('spec.pdf', Buffer.from('%PDF-1.4 file content'));
      mockDataSource.transaction.mockRejectedValue(new Error('DB transaction error'));

      await expect(
        service.upload(PROJECT_ID, ACTOR_ID, file, { title: 'Spec Title' }),
      ).rejects.toThrow('DB transaction error');

      expect(mockStorageDriver.delete).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('queries documents with filters and pagination', async () => {
      interface MockDocBuilder {
        where: () => MockDocBuilder;
        andWhere: () => MockDocBuilder;
        orderBy: () => MockDocBuilder;
        addOrderBy: () => MockDocBuilder;
        skip: () => MockDocBuilder;
        take: () => MockDocBuilder;
        getManyAndCount: () => Promise<[Document[], number]>;
      }
      const qb: MockDocBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[makeDocument()], 1]),
      };
      mockDocRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.list(PROJECT_ID, {
        search: 'spec',
        mimeType: 'application/pdf',
        page: 1,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(qb.where).toHaveBeenCalledWith('doc.projectId = :projectId', {
        projectId: PROJECT_ID,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('doc.deletedAt IS NULL');
    });
  });

  describe('getById', () => {
    it('returns the document when found', async () => {
      const doc = makeDocument();
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.getById(PROJECT_ID, DOC_ID);
      expect(result).toEqual(doc);
    });

    it('throws NotFoundException when document does not exist', async () => {
      mockDocRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(PROJECT_ID, DOC_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates title and description with matching version', async () => {
      const doc = makeDocument({ version: 2 });
      mockDocRepo.findOne.mockResolvedValue(doc);
      mockDocRepo.save.mockImplementation(async (d) => ({ ...d, version: 3 }));

      const updated = await service.update(PROJECT_ID, DOC_ID, ACTOR_ID, {
        version: 2,
        title: 'New Title',
        description: 'New Description',
      });

      expect(updated.title).toBe('New Title');
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DOCUMENT_UPDATED',
          entityType: 'DOCUMENT',
        }),
      );
    });

    it('throws ConflictException on version mismatch', async () => {
      const doc = makeDocument({ version: 3 });
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.update(PROJECT_ID, DOC_ID, ACTOR_ID, {
          version: 2,
          title: 'New Title',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createRevision', () => {
    it('replaces file, increments revision, and records audit log', async () => {
      const doc = makeDocument({ revision: 1 });
      mockDocRepo.findOne.mockResolvedValue(doc);

      const newFile = makeMulterFile('v2.pdf', Buffer.from('%PDF-1.5 updated file'));

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const manager = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === Document) {
              return {
                save: jest.fn().mockImplementation(async (d) => d),
              };
            }
            if (entity === DocumentRevision) {
              return {
                create: jest.fn().mockReturnValue(makeRevision({ revision: 2 })),
                save: jest.fn().mockResolvedValue(makeRevision({ revision: 2 })),
              };
            }
          }),
        };
        return cb(manager);
      });

      const result = await service.createRevision(PROJECT_ID, DOC_ID, ACTOR_ID, newFile);

      expect(result.revision).toBe(2);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DOCUMENT_REPLACED',
          entityType: 'DOCUMENT',
        }),
      );
    });

    it('compensates by deleting uploaded replacement file if DB transaction fails', async () => {
      const doc = makeDocument({ revision: 1 });
      mockDocRepo.findOne.mockResolvedValue(doc);

      const newFile = makeMulterFile('v2.pdf', Buffer.from('%PDF-1.5 updated file'));
      mockDataSource.transaction.mockRejectedValue(new Error('DB failure during revision'));

      await expect(service.createRevision(PROJECT_ID, DOC_ID, ACTOR_ID, newFile)).rejects.toThrow(
        'DB failure during revision',
      );

      expect(mockStorageDriver.delete).toHaveBeenCalled();
    });
  });

  describe('getDownloadStream', () => {
    it('returns the file stream and records audit log', async () => {
      const doc = makeDocument();
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.getDownloadStream(PROJECT_ID, DOC_ID, ACTOR_ID);

      expect(result.mimeType).toBe('application/pdf');
      expect(result.originalFilename).toBe('test.pdf');
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DOCUMENT_DOWNLOADED',
          entityType: 'DOCUMENT',
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('allows OWNER to delete any document', async () => {
      const doc = makeDocument({ createdBy: OTHER_USER });
      mockDocRepo.findOne.mockResolvedValue(doc);
      mockDocRepo.save.mockImplementation(async (d) => d);

      await service.softDelete(PROJECT_ID, DOC_ID, ACTOR_ID, ProjectRole.OWNER);

      expect(doc.deletedAt).toBeInstanceOf(Date);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DOCUMENT_DELETED',
          entityType: 'DOCUMENT',
        }),
      );
    });

    it('allows CONTRIBUTOR to delete their own document', async () => {
      const doc = makeDocument({ createdBy: ACTOR_ID });
      mockDocRepo.findOne.mockResolvedValue(doc);
      mockDocRepo.save.mockImplementation(async (d) => d);

      await expect(
        service.softDelete(PROJECT_ID, DOC_ID, ACTOR_ID, ProjectRole.CONTRIBUTOR),
      ).resolves.not.toThrow();

      expect(doc.deletedAt).toBeInstanceOf(Date);
    });

    it('forbids CONTRIBUTOR from deleting someone else document', async () => {
      const doc = makeDocument({ createdBy: OTHER_USER });
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.softDelete(PROJECT_ID, DOC_ID, ACTOR_ID, ProjectRole.CONTRIBUTOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forbids VIEWER from deleting document', async () => {
      const doc = makeDocument({ createdBy: ACTOR_ID });
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.softDelete(PROJECT_ID, DOC_ID, ACTOR_ID, ProjectRole.VIEWER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listRevisions', () => {
    it('returns revisions ordered by revision DESC', async () => {
      mockDocRepo.findOne.mockResolvedValue(makeDocument());
      const revs = [makeRevision({ revision: 2 }), makeRevision({ revision: 1 })];
      mockRevRepo.find.mockResolvedValue(revs);

      const result = await service.listRevisions(PROJECT_ID, DOC_ID);

      expect(result).toHaveLength(2);
      expect(mockRevRepo.find).toHaveBeenCalledWith({
        where: { documentId: DOC_ID },
        order: { revision: 'DESC' },
      });
    });
  });
});
