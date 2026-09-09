import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Session } from '../../modules/auth/entities/session.entity';

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Session | null => {
    const request = ctx.switchToHttp().getRequest<{ session?: Session }>();
    return request.session ?? null;
  },
);
