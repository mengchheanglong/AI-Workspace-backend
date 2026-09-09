import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService } from '../../modules/auth/services/session.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { User } from '../../modules/users/entities/user.entity';
import { Session } from '../../modules/auth/entities/session.entity';

declare module 'express' {
  interface Request {
    user?: User;
    session?: Session;
    rawSessionToken?: string;
  }
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const cookieName = this.sessionService.getCookieName();
    const rawToken = request.cookies?.[cookieName] || request.cookies?.['aiws_session'];

    if (!rawToken) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
      });
    }

    const validated = await this.sessionService.validateSession(rawToken);

    if (!validated) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired or is invalid. Please log in again.',
      });
    }

    request.user = validated.user;
    request.session = validated.session;
    request.rawSessionToken = rawToken;

    return true;
  }
}
