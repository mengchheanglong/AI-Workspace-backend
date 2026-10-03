import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { ApiKeyService, API_KEY_PREFIX } from '../../src/modules/auth/services/api-key.service';
import { SessionAuthGuard } from '../../src/common/guards/session-auth.guard';
import { SessionService } from '../../src/modules/auth/services/session.service';
import { ApiKey } from '../../src/modules/auth/entities/api-key.entity';
import { User, ProfessionalRole, SystemRole } from '../../src/modules/users/entities/user.entity';

describe('ApiKeyService & Bearer Auth', () => {
  let service: ApiKeyService;
  let apiKeyRepo: jest.Mocked<Repository<ApiKey>>;
  let userRepo: jest.Mocked<Repository<User>>;

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'alice@example.com',
    displayName: 'Alice Developer',
    passwordHash: 'hash',
    systemRole: SystemRole.USER,
    professionalRole: ProfessionalRole.DEVELOPER,
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    apiKeyRepo = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'key-uuid-1' })),
      save: jest
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve({ ...entity, id: entity.id || 'key-uuid-1' }),
        ),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as jest.Mocked<Repository<ApiKey>>;

    userRepo = {
      findOne: jest.fn().mockResolvedValue(mockUser),
    } as unknown as jest.Mocked<Repository<User>>;

    service = new ApiKeyService(apiKeyRepo, userRepo);
  });

  describe('createKey', () => {
    it('creates an API key with aiw_pat_ prefix and returns the raw secret token once', async () => {
      const res = await service.createKey(mockUser.id, { name: 'Claude Code CLI' });

      expect(res.rawToken).toBeDefined();
      expect(res.rawToken.startsWith(API_KEY_PREFIX)).toBe(true);
      expect(res.apiKey.name).toBe('Claude Code CLI');
      expect(res.apiKey.keyPrefix.startsWith(API_KEY_PREFIX)).toBe(true);
      expect(res.apiKey.keyHash).toBe(service.hashToken(res.rawToken));
      expect(apiKeyRepo.save).toHaveBeenCalled();
    });

    it('sets expiresAt when expiresInDays is provided', async () => {
      const res = await service.createKey(mockUser.id, { name: 'Expiring Key', expiresInDays: 30 });
      expect(res.apiKey.expiresAt).toBeInstanceOf(Date);
      expect(res.apiKey.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('validateKey', () => {
    it('validates a valid unexpired key and returns user', async () => {
      const { rawToken } = await service.createKey(mockUser.id, { name: 'Test Key' });
      const hash = service.hashToken(rawToken);

      const mockKey: ApiKey = {
        id: 'key-uuid-1',
        userId: mockUser.id,
        user: mockUser,
        name: 'Test Key',
        keyHash: hash,
        keyPrefix: 'aiw_pat_1234',
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        revokedAt: null,
      };

      apiKeyRepo.findOne.mockResolvedValueOnce(mockKey);

      const validatedUser = await service.validateKey(rawToken);
      expect(validatedUser).toEqual(mockUser);
      expect(apiKeyRepo.update).toHaveBeenCalledWith(
        'key-uuid-1',
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });

    it('returns null for an invalid token format or non-existent token', async () => {
      expect(await service.validateKey('invalid-token')).toBeNull();
      apiKeyRepo.findOne.mockResolvedValueOnce(null);
      expect(
        await service.validateKey(`${API_KEY_PREFIX}1234567890abcdef1234567890abcdef`),
      ).toBeNull();
    });

    it('returns null for an expired token', async () => {
      const expiredKey: ApiKey = {
        id: 'key-uuid-1',
        userId: mockUser.id,
        user: mockUser,
        name: 'Expired Key',
        keyHash: 'hash',
        keyPrefix: 'aiw_pat_1234',
        lastUsedAt: null,
        expiresAt: new Date(Date.now() - 10000),
        createdAt: new Date(),
        revokedAt: null,
      };
      apiKeyRepo.findOne.mockResolvedValueOnce(expiredKey);

      expect(
        await service.validateKey(`${API_KEY_PREFIX}1234567890abcdef1234567890abcdef`),
      ).toBeNull();
    });
  });

  describe('SessionAuthGuard integration', () => {
    let guard: SessionAuthGuard;
    let reflector: jest.Mocked<Reflector>;
    let sessionService: jest.Mocked<SessionService>;

    beforeEach(() => {
      reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(false),
      } as unknown as jest.Mocked<Reflector>;

      sessionService = {
        getCookieName: jest.fn().mockReturnValue('aiws_session'),
        validateSession: jest.fn().mockResolvedValue(null),
      } as unknown as jest.Mocked<SessionService>;

      guard = new SessionAuthGuard(reflector, sessionService, service);
    });

    function createMockContext(
      headers: Record<string, string>,
      cookies: Record<string, string> = {},
    ): ExecutionContext {
      const req = { headers, cookies };
      return {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;
    }

    it('authenticates request via Authorization: Bearer aiw_pat_...', async () => {
      jest.spyOn(service, 'validateKey').mockResolvedValueOnce(mockUser);

      const ctx = createMockContext({
        authorization: `Bearer ${API_KEY_PREFIX}testtoken123456789`,
      });
      const canActivate = await guard.canActivate(ctx);

      expect(canActivate).toBe(true);
      const req = ctx.switchToHttp().getRequest<{ user?: User }>();
      expect(req.user).toEqual(mockUser);
    });

    it('rejects invalid Bearer aiw_pat_... token with INVALID_API_KEY', async () => {
      jest.spyOn(service, 'validateKey').mockResolvedValueOnce(null);

      const ctx = createMockContext({ authorization: `Bearer ${API_KEY_PREFIX}badtoken123456789` });
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });
});
