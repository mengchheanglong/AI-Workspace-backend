import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from '../../modules/projects/entities/project-member.entity';

export const PROJECT_ROLES_KEY = 'project_roles';
export const RequireProjectRole = (...roles: ProjectRole[]) =>
  SetMetadata(PROJECT_ROLES_KEY, roles);

export const ALLOW_ARCHIVED_KEY = 'allow_archived';
export const AllowArchived = () => SetMetadata(ALLOW_ARCHIVED_KEY, true);
