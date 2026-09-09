import { PasswordService } from '../../src/modules/auth/services/password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hashes passwords using Argon2id and verifies correct passwords', async () => {
    const raw = 'SuperSecretPass123!';
    const hash = await service.hash(raw);

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await service.verify(hash, raw)).toBe(true);
    expect(await service.verify(hash, 'WrongPassword123!')).toBe(false);
  });

  it('handles invalid hash formats gracefully without throwing unhandled exceptions', async () => {
    expect(await service.verify('invalid-hash', 'password')).toBe(false);
    expect(await service.verify('', 'password')).toBe(false);
  });

  it('generates secure random temporary passwords with requested length', () => {
    const p1 = service.generateSecurePassword(16);
    const p2 = service.generateSecurePassword(16);

    expect(p1).toHaveLength(16);
    expect(p2).toHaveLength(16);
    expect(p1).not.toEqual(p2);
  });
});
