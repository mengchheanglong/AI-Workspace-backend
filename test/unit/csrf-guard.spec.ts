import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from '../../src/common/guards/csrf.guard';
import { SessionService } from '../../src/modules/auth/services/session.service';
import { Session } from '../../src/modules/auth/entities/session.entity';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let reflector: jest.Mocked<Reflector>;
  let sessionService: jest.Mocked<SessionService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    sessionService = {
      verifyCsrfToken: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    guard = new CsrfGuard(reflector, sessionService);
  });

  function createMockContext(
    method: string,
    headers: Record<string, string>,
    session?: Session,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          headers,
          session,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('allows safe read methods without checking CSRF tokens', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const ctx = createMockContext(method, {});
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });

  it('allows public routes even for POST mutations', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = createMockContext('POST', {});
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects POST mutations with missing x-csrf-token header', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const session = { id: 's1' } as Session;
    const ctx = createMockContext('POST', {}, session);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects POST mutations with invalid x-csrf-token header', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const session = { id: 's1' } as Session;
    sessionService.verifyCsrfToken.mockReturnValue(false);

    const ctx = createMockContext('POST', { 'x-csrf-token': 'wrong' }, session);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows POST mutations with valid x-csrf-token header', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const session = { id: 's1' } as Session;
    sessionService.verifyCsrfToken.mockReturnValue(true);

    const ctx = createMockContext('POST', { 'x-csrf-token': 'valid' }, session);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
