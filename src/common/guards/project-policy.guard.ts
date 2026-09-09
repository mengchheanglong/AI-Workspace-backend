import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { Request } from 'express';
import { ALLOW_ARCHIVED_KEY, PROJECT_ROLES_KEY } from '../decorators/project-role.decorator';
import { ProjectMember, ProjectRole } from '../../modules/projects/entities/project-member.entity';
import { ProjectStatus } from '../../modules/projects/entities/project.entity';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class ProjectPolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(ProjectMember)
    private readonly memberRepository: Repository<ProjectMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const param = request.params.projectId;
    const projectId = Array.isArray(param) ? param[0] : param;

    // If route doesn't have a :projectId parameter, skip project scoping
    if (!projectId) {
      return true;
    }

    const user = request.user;
    if (!user) {
      // SessionAuthGuard handles unauthenticated requests
      return true;
    }

    const membership = await this.memberRepository.findOne({
      where: {
        projectId,
        userId: user.id,
        removedAt: IsNull(),
      },
      relations: ['project'],
    });

    // Inaccessible or nonexistent project returns 404 to prevent resource enumeration
    if (!membership || !membership.project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.',
      });
    }

    const project = membership.project;

    // Archived project check: mutations are rejected unless explicitly allowed
    if (
      project.status === ProjectStatus.ARCHIVED &&
      MUTATING_METHODS.has(request.method.toUpperCase())
    ) {
      const allowArchived = this.reflector.getAllAndOverride<boolean>(ALLOW_ARCHIVED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (!allowArchived) {
        throw new BadRequestException({
          code: 'PROJECT_ARCHIVED',
          message: 'This project is archived and read-only.',
        });
      }
    }

    // Role check: verify user has required project access role
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(PROJECT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(membership.accessRole)) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action in this project.',
        });
      }
    }

    // Attach project and membership context to request
    request.project = project;
    request.membership = membership;

    return true;
  }
}
