import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SYSTEM_ROLES_KEY } from '../decorators/roles.decorator';
import { SystemRole } from '../../modules/users/entities/user.entity';

@Injectable()
export class SystemRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(SYSTEM_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.systemRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have the required role to access this resource.',
      });
    }

    return true;
  }
}
