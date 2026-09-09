import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRolesGuard } from '../../src/common/guards/system-roles.guard';
import { ProfessionalRole, SystemRole, User } from '../../src/modules/users/entities/user.entity';

describe('SystemRolesGuard', () => {
  let guard: SystemRolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new SystemRolesGuard(reflector);
  });

  function createMockContext(user?: User): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('allows access if no system roles are required on route', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = createMockContext();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access if user possesses the required system role', () => {
    reflector.getAllAndOverride.mockReturnValue([SystemRole.ADMIN]);
    const adminUser: User = {
      id: 'admin-1',
      email: 'admin@workspace.local',
      displayName: 'Admin',
      passwordHash: 'hash',
      systemRole: SystemRole.ADMIN,
      professionalRole: ProfessionalRole.INFRASTRUCTURE,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const ctx = createMockContext(adminUser);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException if user does not possess the required system role', () => {
    reflector.getAllAndOverride.mockReturnValue([SystemRole.ADMIN]);
    const regularUser: User = {
      id: 'user-1',
      email: 'user@workspace.local',
      displayName: 'User',
      passwordHash: 'hash',
      systemRole: SystemRole.USER,
      professionalRole: ProfessionalRole.DEVELOPER,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const ctx = createMockContext(regularUser);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
