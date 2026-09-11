import { ApiProperty } from '@nestjs/swagger';
import { DocumentRevision } from '../entities/document-revision.entity';

export class DocumentRevisionResponseDto {
  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  id!: string;

  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  documentId!: string;

  @ApiProperty({ example: 1 })
  revision!: number;

  @ApiProperty({ example: 'architecture_v1.pdf' })
  originalFilename!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 1048576 })
  sizeBytes!: number;

  @ApiProperty({ example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })
  sha256!: string;

  @ApiProperty()
  changedBy!: string;

  @ApiProperty({ example: '2026-09-11T10:00:00.000Z' })
  createdAt!: string;

  static fromEntity(rev: DocumentRevision): DocumentRevisionResponseDto {
    return {
      id: rev.id,
      documentId: rev.documentId,
      revision: rev.revision,
      originalFilename: rev.originalFilename,
      mimeType: rev.mimeType,
      sizeBytes: Number(rev.sizeBytes),
      sha256: rev.sha256,
      changedBy: rev.changedBy,
      createdAt: rev.createdAt instanceof Date ? rev.createdAt.toISOString() : rev.createdAt,
    };
  }
}
