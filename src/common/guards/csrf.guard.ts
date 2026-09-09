import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService } from '../../modules/auth/services/session.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const session = request.session;
    if (!session) {
      // If there is no session, SessionAuthGuard will handle unauthenticated access.
      return true;
    }

    const csrfHeader = request.headers['x-csrf-token'];
    const rawCsrfToken = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;

    if (!rawCsrfToken || !this.sessionService.verifyCsrfToken(session, rawCsrfToken)) {
      throw new ForbiddenException({
        code: 'CSRF_INVALID',
        message: 'Invalid or missing CSRF token.',
      });
    }

    return true;
  }
}
