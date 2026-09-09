import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../../src/modules/auth/services/session.service';
import { Session } from '../../src/modules/auth/entities/session.entity';
import { ProfessionalRole, SystemRole, User } from '../../src/modules/users/entities/user.entity';
import { Environment } from '../../src/config/environment';

describe('SessionService', () => {
  let service: SessionService;
  let repo: jest.Mocked<Repository<Session>>;
  let config: jest.Mocked<ConfigService<Environment, true>>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hash',
    systemRole: SystemRole.USER,
    professionalRole: ProfessionalRole.DEVELOPER,
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      create: jest.fn((entity) => entity as Session),
      save: jest.fn(async (entity) => ({ ...entity, id: 'session-1' }) as Session),
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<Session>>;

    config = {
      get: jest.fn((key: string) => {
        if (key === 'SESSION_IDLE_HOURS') return 8;
        if (key === 'SESSION_ABSOLUTE_DAYS') return 7;
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService<Environment, true>>;

    service = new SessionService(repo, config);
  });

  it('hashes tokens deterministically with SHA-256', () => {
    const h1 = SessionService.hashToken('my-token');
    const h2 = SessionService.hashToken('my-token');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('creates sessions with proper sliding idle and absolute expiration windows', async () => {
    const before = Date.now();
    const result = await service.createSession('user-1');
    const after = Date.now();

    expect(result.rawToken).toHaveLength(43);
    expect(result.rawCsrfToken).toHaveLength(43);
    expect(result.session.userId).toBe('user-1');

    const eightHoursMs = 8 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(result.session.expiresAt.getTime()).toBeGreaterThanOrEqual(before + eightHoursMs);
    expect(result.session.expiresAt.getTime()).toBeLessThanOrEqual(after + eightHoursMs);

    expect(result.session.absoluteExpiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs);
    expect(result.session.absoluteExpiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs);
  });

  it('validates active sessions and slides idle expiration', async () => {
    const now = new Date();
    const mockSession: Session = {
      id: 'session-1',
      userId: 'user-1',
      user: mockUser,
      tokenHash: SessionService.hashToken('valid-token'),
      csrfTokenHash: 'csrf-hash',
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + 1000 * 60 * 60), // 1 hour left
      absoluteExpiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24),
      revokedAt: null,
    };

    repo.findOne.mockResolvedValue(mockSession);

    const validated = await service.validateSession('valid-token');
    expect(validated).not.toBeNull();
    expect(validated?.user.id).toBe('user-1');
    expect(repo.save).toHaveBeenCalled();
  });

  it('rejects revoked or expired sessions', async () => {
    const now = new Date();
    const revokedSession: Session = {
      id: 'session-1',
      userId: 'user-1',
      user: mockUser,
      tokenHash: SessionService.hashToken('revoked-token'),
      csrfTokenHash: 'csrf-hash',
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + 10000),
      absoluteExpiresAt: new Date(now.getTime() + 10000),
      revokedAt: new Date(),
    };

    repo.findOne.mockResolvedValue(revokedSession);
    expect(await service.validateSession('revoked-token')).toBeNull();

    const expiredSession: Session = {
      ...revokedSession,
      revokedAt: null,
      expiresAt: new Date(now.getTime() - 1000),
    };

    repo.findOne.mockResolvedValue(expiredSession);
    expect(await service.validateSession('expired-token')).toBeNull();
  });

  it('verifies CSRF token hashes correctly and timing-safely', () => {
    const rawCsrf = 'my-csrf-token';
    const csrfHash = SessionService.hashToken(rawCsrf);
    const session = { csrfTokenHash: csrfHash } as Session;

    expect(service.verifyCsrfToken(session, rawCsrf)).toBe(true);
    expect(service.verifyCsrfToken(session, 'wrong-csrf-token')).toBe(false);
    expect(service.verifyCsrfToken(session, '')).toBe(false);
  });
});
