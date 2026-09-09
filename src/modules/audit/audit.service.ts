import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async record(dto: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.auditRepository.create({
      projectId: dto.projectId ?? null,
      actorId: dto.actorId ?? null,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId ?? null,
      metadata: dto.metadata ?? null,
      requestId: dto.requestId ?? null,
    });
    return this.auditRepository.save(log);
  }

  async listForProject(
    projectId: string,
    page = 1,
    pageSize = 50,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await this.auditRepository.findAndCount({
      where: { projectId },
      order: { createdAt: 'DESC' },
      relations: ['actor'],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { logs, total };
  }
}
