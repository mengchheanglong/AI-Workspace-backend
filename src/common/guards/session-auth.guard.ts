import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService } from '../../modules/auth/services/session.service';
import { ApiKeyService, API_KEY_PREFIX } from '../../modules/auth/services/api-key.service';
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
    @Optional()
    private readonly apiKeyService?: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();

    // 1. Check for Authorization header (Bearer token) or x-api-key header
    const authHeader = request.headers['authorization'];
    const apiKeyHeader = request.headers['x-api-key'];
    let bearerToken: string | undefined;

    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      bearerToken = authHeader.slice(7).trim();
    } else if (typeof apiKeyHeader === 'string') {
      bearerToken = apiKeyHeader.trim();
    }

    if (bearerToken) {
      if (bearerToken.startsWith(API_KEY_PREFIX) && this.apiKeyService) {
        const user = await this.apiKeyService.validateKey(bearerToken);
        if (!user) {
          if (isPublic) {
            return true;
          }
          throw new UnauthorizedException({
            code: 'INVALID_API_KEY',
            message: 'Personal access token is invalid, revoked, or expired.',
          });
        }
        request.user = user;
        request.rawSessionToken = bearerToken;
        return true;
      }

      // Allow Bearer token session authentication for API clients
      const validated = await this.sessionService.validateSession(bearerToken);
      if (validated) {
        request.user = validated.user;
        request.session = validated.session;
        request.rawSessionToken = bearerToken;
        return true;
      }
    }

    // 2. Cookie session check
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
