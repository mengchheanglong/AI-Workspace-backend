import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Task, TaskStatus } from '../tasks/entities/task.entity';
import { Requirement } from '../requirements/entities/requirement.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import {
  DashboardResponseDto,
  RecentActivityItemDto,
  TaskCountsByStatusDto,
  RequirementCountsByStatusDto,
  TaskProgressDto,
} from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Requirement)
    private readonly requirementRepository: Repository<Requirement>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  getTodayInTimezone(timezone = 'Asia/Bangkok'): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(new Date());
    } catch {
      // Fallback to UTC if timezone name is invalid
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(new Date());
    }
  }

  async getDashboard(
    projectId: string,
    userId: string,
    timezone = 'Asia/Bangkok',
  ): Promise<DashboardResponseDto> {
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.',
      });
    }

    const todayInTz = this.getTodayInTimezone(timezone);

    // Fetch tasks and requirements for calculations
    const [tasks, requirements, recentLogs] = await Promise.all([
      this.taskRepository.find({
        where: { projectId, deletedAt: IsNull() },
        select: ['id', 'status', 'dueDate', 'assigneeId'],
      }),
      this.requirementRepository.find({
        where: { projectId, deletedAt: IsNull() },
        select: ['id', 'status'],
      }),
      this.auditRepository.find({
        where: { projectId },
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['actor'],
      }),
    ]);

    // Task counts by status
    const taskCounts: TaskCountsByStatusDto = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
      CANCELLED: 0,
    };

    let overdueTasksCount = 0;
    let myAssignedTasksCount = 0;

    for (const t of tasks) {
      if (taskCounts[t.status] !== undefined) {
        taskCounts[t.status]++;
      }

      const isClosed = t.status === TaskStatus.DONE || t.status === TaskStatus.CANCELLED;
      if (!isClosed) {
        if (t.dueDate && t.dueDate < todayInTz) {
          overdueTasksCount++;
        }
        if (t.assigneeId === userId) {
          myAssignedTasksCount++;
        }
      }
    }

    // Task progress calculation
    // Progress = done / (all non-deleted, non-cancelled tasks) * 100
    const nonCancelledTotal =
      taskCounts.TODO + taskCounts.IN_PROGRESS + taskCounts.IN_REVIEW + taskCounts.DONE;
    const doneCount = taskCounts.DONE;
    const progressPercentage =
      nonCancelledTotal > 0 ? Math.round((doneCount / nonCancelledTotal) * 100) : null;
    const progressLabel = progressPercentage !== null ? `${progressPercentage}%` : 'No tasks yet';

    const taskProgress: TaskProgressDto = {
      done: doneCount,
      total: nonCancelledTotal,
      percentage: progressPercentage,
      label: progressLabel,
    };

    // Requirement counts by status
    const requirementCounts: RequirementCountsByStatusDto = {
      DRAFT: 0,
      APPROVED: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      ARCHIVED: 0,
    };

    for (const r of requirements) {
      if (requirementCounts[r.status] !== undefined) {
        requirementCounts[r.status]++;
      }
    }

    const recentActivity = recentLogs.map((log) => this.mapAuditLogToDto(log));

    return {
      project: {
        id: project.id,
        key: project.key,
        name: project.name,
        description: project.description,
        status: project.status,
      },
      taskProgress,
      taskCountsByStatus: taskCounts,
      overdueTasksCount,
      myAssignedTasksCount,
      requirementCountsByStatus: requirementCounts,
      summary: project.description,
      recentActivity,
    };
  }

  async getActivity(
    projectId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: RecentActivityItemDto[]; total: number }> {
    const [logs, total] = await this.auditRepository.findAndCount({
      where: { projectId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ['actor'],
    });

    return {
      data: logs.map((log) => this.mapAuditLogToDto(log)),
      total,
    };
  }

  private mapAuditLogToDto(log: AuditLog): RecentActivityItemDto {
    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actor: log.actor
        ? {
            id: log.actor.id,
            displayName: log.actor.displayName,
            email: log.actor.email,
          }
        : null,
      metadata: log.metadata,
      createdAt: log.createdAt,
    };
  }
}
