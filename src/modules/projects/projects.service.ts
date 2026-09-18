import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectMember, ProjectRole } from './entities/project-member.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly memberRepository: Repository<ProjectMember>,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async listUserProjects(
    userId: string,
    status?: ProjectStatus,
  ): Promise<{ project: Project; accessRole: ProjectRole }[]> {
    const memberships = await this.memberRepository.find({
      where: {
        userId,
        removedAt: IsNull(),
      },
      relations: ['project'],
      order: { joinedAt: 'DESC' },
    });

    let results = memberships.filter((m) => !!m.project);

    if (status) {
      results = results.filter((m) => m.project.status === status);
    }

    return results.map((m) => ({
      project: m.project,
      accessRole: m.accessRole,
    }));
  }

  async getProject(
    projectId: string,
    userId: string,
  ): Promise<{ project: Project; accessRole: ProjectRole }> {
    const membership = await this.memberRepository.findOne({
      where: {
        projectId,
        userId,
        removedAt: IsNull(),
      },
      relations: ['project'],
    });

    if (!membership || !membership.project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.',
      });
    }

    return {
      project: membership.project,
      accessRole: membership.accessRole,
    };
  }

  async createProject(
    userId: string,
    dto: CreateProjectDto,
    requestId?: string,
  ): Promise<{ project: Project; accessRole: ProjectRole }> {
    const key = dto.key.trim().toUpperCase();

    const existing = await this.projectRepository.findOne({ where: { key } });
    if (existing) {
      throw new ConflictException({
        code: 'PROJECT_KEY_EXISTS',
        message: 'A project with this key already exists.',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const project = manager.create(Project, {
        key,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        status: ProjectStatus.ACTIVE,
        createdBy: userId,
        version: 1,
      });

      const savedProject = await manager.save(Project, project);

      const member = manager.create(ProjectMember, {
        projectId: savedProject.id,
        userId,
        accessRole: ProjectRole.OWNER,
        joinedAt: new Date(),
        removedAt: null,
      });

      await manager.save(ProjectMember, member);

      await this.auditService.record(
        {
          projectId: savedProject.id,
          actorId: userId,
          action: 'PROJECT_CREATED',
          entityType: 'PROJECT',
          entityId: savedProject.id,
          metadata: { key: savedProject.key, name: savedProject.name },
          requestId,
        },
        manager,
      );

      return {
        project: savedProject,
        accessRole: ProjectRole.OWNER,
      };
    });
  }

  async updateProject(
    projectId: string,
    actorId: string,
    dto: UpdateProjectDto,
    requestId?: string,
  ): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.',
      });
    }

    if (dto.version !== undefined && project.version !== dto.version) {
      throw new ConflictException({
        code: 'CONCURRENCY_CONFLICT',
        message: 'Project has been modified by another request. Please reload.',
      });
    }

    if (dto.name !== undefined) {
      project.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      project.description = dto.description.trim();
    }

    const saved = await this.projectRepository.save(project);

    await this.auditService.record({
      projectId: saved.id,
      actorId,
      action: 'PROJECT_UPDATED',
      entityType: 'PROJECT',
      entityId: saved.id,
      metadata: { name: saved.name, version: saved.version },
      requestId,
    });

    return saved;
  }

  async archiveProject(projectId: string, actorId: string, requestId?: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.',
      });
    }

    project.status = ProjectStatus.ARCHIVED;
    const saved = await this.projectRepository.save(project);

    await this.auditService.record({
      projectId: saved.id,
      actorId,
      action: 'PROJECT_ARCHIVED',
      entityType: 'PROJECT',
      entityId: saved.id,
      requestId,
    });

    return saved;
  }

  async unarchiveProject(projectId: string, actorId: string, requestId?: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.',
      });
    }

    project.status = ProjectStatus.ACTIVE;
    const saved = await this.projectRepository.save(project);

    await this.auditService.record({
      projectId: saved.id,
      actorId,
      action: 'PROJECT_UNARCHIVED',
      entityType: 'PROJECT',
      entityId: saved.id,
      requestId,
    });

    return saved;
  }
}
