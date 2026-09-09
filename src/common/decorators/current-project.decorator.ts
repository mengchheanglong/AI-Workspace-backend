import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Project } from '../../modules/projects/entities/project.entity';
import { ProjectMember } from '../../modules/projects/entities/project-member.entity';

declare module 'express' {
  interface Request {
    project?: Project;
    membership?: ProjectMember;
  }
}

export const CurrentProject = createParamDecorator(
  (data: keyof Project | undefined, ctx: ExecutionContext): Project | unknown => {
    const request = ctx.switchToHttp().getRequest<{ project?: Project }>();
    const project = request.project;
    if (!project) {
      return null;
    }
    return data ? project[data] : project;
  },
);

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectMember | null => {
    const request = ctx.switchToHttp().getRequest<{ membership?: ProjectMember }>();
    return request.membership ?? null;
  },
);
