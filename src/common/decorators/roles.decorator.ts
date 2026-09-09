import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '../../modules/users/entities/user.entity';

export const SYSTEM_ROLES_KEY = 'system_roles';
export const SystemRoles = (...roles: SystemRole[]) => SetMetadata(SYSTEM_ROLES_KEY, roles);
