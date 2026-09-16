import { validateEnvironment } from '../../src/config/environment';

const valid = {
  APP_ORIGIN: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://user:private@localhost:5432/dev',
};

describe('Environment validation', () => {
  it('allows Phase 1 without provider credentials and parses false correctly', () => {
    const config = validateEnvironment({
      ...valid,
      AI_ENABLED: 'false',
      SWAGGER_ENABLED: 'false',
      PORT: '3000',
    });
    expect(config.AI_ENABLED).toBe(false);
    expect(config.SWAGGER_ENABLED).toBe(false);
    expect(config.PORT).toBe(3000);
    expect(config.AI_CHAT_MODEL).toBe('deepseek-v4-pro');
  });

  it.each([
    { PORT: 'not-a-number' },
    { PORT: '0' },
    { AI_ENABLED: 'yes' },
    { AI_ENABLED: 'true' },
    { GITHUB_ENABLED: 'true' },
    { AI_CHAT_MODEL: 'another-model' },
    { APP_ORIGIN: 'http://localhost:3001/path' },
    { NODE_ENV: 'production', SWAGGER_ENABLED: 'true' },
  ])('rejects invalid or unsupported configuration %j', (override) => {
    expect(() => validateEnvironment({ ...valid, ...override })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('names invalid fields without leaking supplied values', () => {
    expect(() => validateEnvironment({ ...valid, DATABASE_URL: 'very-private-secret' })).toThrow(
      'DATABASE_URL',
    );
    expect(() =>
      validateEnvironment({ ...valid, DATABASE_URL: 'very-private-secret' }),
    ).not.toThrow('very-private-secret');
  });

  it('accepts empty string for optional admin credentials and treats as undefined', () => {
    const config = validateEnvironment({
      ...valid,
      INITIAL_ADMIN_EMAIL: '',
      INITIAL_ADMIN_PASSWORD: '',
    });
    expect(config.INITIAL_ADMIN_EMAIL).toBeUndefined();
    expect(config.INITIAL_ADMIN_PASSWORD).toBeUndefined();
  });

  it('accepts valid admin credentials when both are provided', () => {
    const config = validateEnvironment({
      ...valid,
      INITIAL_ADMIN_EMAIL: 'admin@example.com',
      INITIAL_ADMIN_PASSWORD: 'admin-password-123',
    });
    expect(config.INITIAL_ADMIN_EMAIL).toBe('admin@example.com');
    expect(config.INITIAL_ADMIN_PASSWORD).toBe('admin-password-123');
  });

  it('rejects when only one admin bootstrap credential is provided', () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        INITIAL_ADMIN_EMAIL: 'admin@example.com',
        INITIAL_ADMIN_PASSWORD: '',
      }),
    ).toThrow('INITIAL_ADMIN_PASSWORD');

    expect(() =>
      validateEnvironment({
        ...valid,
        INITIAL_ADMIN_EMAIL: '',
        INITIAL_ADMIN_PASSWORD: 'admin-password-123',
      }),
    ).toThrow('INITIAL_ADMIN_EMAIL');
  });
});
