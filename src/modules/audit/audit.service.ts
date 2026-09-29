import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async record(dto: CreateAuditLogDto, manager?: EntityManager): Promise<AuditLog> {
    const data = {
      projectId: dto.projectId ?? null,
      actorId: dto.actorId ?? null,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId ?? null,
      metadata: dto.metadata ?? null,
      requestId: dto.requestId ?? null,
    };
    if (manager) {
      if (typeof manager.getRepository === 'function') {
        const repo = manager.getRepository(AuditLog);
        const log = repo.create(data);
        return repo.save(log);
      }
      const log = manager.create(AuditLog, data);
      return manager.save(AuditLog, log) as Promise<AuditLog>;
    }
    const log = this.auditRepository.create(data);
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
