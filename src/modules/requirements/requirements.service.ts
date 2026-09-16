import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { Requirement, RequirementStatus, Priority } from './entities/requirement.entity';
import { RequirementRevision } from './entities/requirement-revision.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectRole } from '../projects/entities/project-member.entity';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';
import { ListRequirementsQueryDto } from './dto/list-requirements-query.dto';
import { AuditService } from '../audit/audit.service';

/** Column name map for allowlisted sort fields */
const SORT_COLUMN_MAP: Record<string, string> = {
  number: 'requirement.number',
  title: 'requirement.title',
  status: 'requirement.status',
  priority: 'requirement.priority',
  createdAt: 'requirement.createdAt',
  updatedAt: 'requirement.updatedAt',
};

@Injectable()
export class RequirementsService {
  constructor(
    @InjectRepository(Requirement)
    private readonly requirementRepository: Repository<Requirement>,
    @InjectRepository(RequirementRevision)
    private readonly revisionRepository: Repository<RequirementRevision>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    projectId: string,
    actorId: string,
    dto: CreateRequirementDto,
    requestId?: string,
  ): Promise<Requirement> {
    return this.dataSource.transaction(async (manager) => {
      // Allocate project-local number transactionally
      const result: { max: number | null }[] = await manager.query(
        `SELECT MAX("number") as max FROM "requirements" WHERE "project_id" = $1`,
        [projectId],
      );
      const nextNumber = (result[0]?.max ?? 0) + 1;

      const requirement = manager.create(Requirement, {
        projectId,
        number: nextNumber,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        acceptanceCriteria: dto.acceptanceCriteria?.trim() ?? null,
        status: RequirementStatus.DRAFT,
        priority: dto.priority ?? Priority.MEDIUM,
        createdBy: actorId,
        updatedBy: actorId,
        version: 1,
        deletedAt: null,
      });

      const saved = await manager.save(Requirement, requirement);

      // Create initial revision snapshot
      const revision = manager.create(RequirementRevision, {
        requirementId: saved.id,
        version: 1,
        title: saved.title,
        description: saved.description,
        acceptanceCriteria: saved.acceptanceCriteria,
        status: saved.status,
        priority: saved.priority,
        changedBy: actorId,
      });
      await manager.save(RequirementRevision, revision);

      await this.auditService.record({
        projectId,
        actorId,
        action: 'REQUIREMENT_CREATED',
        entityType: 'REQUIREMENT',
        entityId: saved.id,
        metadata: { number: saved.number, title: saved.title },
        requestId,
      });

      return saved;
    });
  }

  async list(
    projectId: string,
    query: ListRequirementsQueryDto,
  ): Promise<{ data: Requirement[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'number';
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb: SelectQueryBuilder<Requirement> = this.requirementRepository
      .createQueryBuilder('requirement')
      .where('requirement.projectId = :projectId', { projectId })
      .andWhere('requirement.deletedAt IS NULL');

    if (query.status) {
      qb.andWhere('requirement.status = :status', { status: query.status });
    }
    if (query.priority) {
      qb.andWhere('requirement.priority = :priority', { priority: query.priority });
    }
    if (query.search) {
      qb.andWhere(
        `to_tsvector('english', coalesce(requirement.title, '') || ' ' || coalesce(requirement.description, '')) @@ plainto_tsquery('english', :search)`,
        { search: query.search },
      );
    }

    const sortColumn = SORT_COLUMN_MAP[sortBy] ?? 'requirement.number';
    qb.orderBy(sortColumn, sortOrder).addOrderBy('requirement.id', 'ASC');

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getById(projectId: string, requirementId: string): Promise<Requirement> {
    const requirement = await this.requirementRepository.findOne({
      where: { id: requirementId, projectId, deletedAt: IsNull() },
    });
    if (!requirement) {
      throw new NotFoundException({
        code: 'REQUIREMENT_NOT_FOUND',
        message: 'Requirement not found.',
      });
    }
    return requirement;
  }

  async update(
    projectId: string,
    requirementId: string,
    actorId: string,
    dto: UpdateRequirementDto,
    requestId?: string,
  ): Promise<Requirement> {
    const requirement = await this.getById(projectId, requirementId);

    if (requirement.version !== dto.version) {
      throw new ConflictException({
        code: 'CONCURRENCY_CONFLICT',
        message: 'Requirement has been modified by another request. Please reload.',
      });
    }

    // Apply updates
    if (dto.title !== undefined) requirement.title = dto.title.trim();
    if (dto.description !== undefined) requirement.description = dto.description.trim();
    if (dto.acceptanceCriteria !== undefined) {
      requirement.acceptanceCriteria = dto.acceptanceCriteria.trim();
    }
    if (dto.status !== undefined) requirement.status = dto.status;
    if (dto.priority !== undefined) requirement.priority = dto.priority;
    requirement.updatedBy = actorId;

    const saved = await this.requirementRepository.save(requirement);

    // Snapshot updated state as a revision
    const revision = this.revisionRepository.create({
      requirementId: saved.id,
      version: saved.version,
      title: saved.title,
      description: saved.description,
      acceptanceCriteria: saved.acceptanceCriteria,
      status: saved.status,
      priority: saved.priority,
      changedBy: actorId,
    });
    await this.revisionRepository.save(revision);

    await this.auditService.record({
      projectId,
      actorId,
      action: 'REQUIREMENT_UPDATED',
      entityType: 'REQUIREMENT',
      entityId: saved.id,
      metadata: { number: saved.number, version: saved.version },
      requestId,
    });

    return saved;
  }

  async softDelete(
    projectId: string,
    requirementId: string,
    actorId: string,
    actorRole: ProjectRole,
    requestId?: string,
  ): Promise<void> {
    const requirement = await this.getById(projectId, requirementId);

    // Contributor can only delete own items; Owner/Manager can delete any
    if (actorRole === ProjectRole.CONTRIBUTOR && requirement.createdBy !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You can only delete requirements you created.',
      });
    }

    requirement.deletedAt = new Date();
    requirement.updatedBy = actorId;
    await this.requirementRepository.save(requirement);

    await this.auditService.record({
      projectId,
      actorId,
      action: 'REQUIREMENT_DELETED',
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      metadata: { number: requirement.number },
      requestId,
    });
  }

  async listRevisions(projectId: string, requirementId: string): Promise<RequirementRevision[]> {
    // Verify requirement belongs to project
    await this.getById(projectId, requirementId);

    return this.revisionRepository.find({
      where: { requirementId },
      order: { version: 'DESC' },
    });
  }

  async getProjectKey(projectId: string): Promise<string> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      select: ['key'],
    });
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.',
      });
    }
    return project.key;
  }
}
