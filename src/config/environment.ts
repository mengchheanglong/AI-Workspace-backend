import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');
const postgresUrl = z
  .string()
  .url()
  .refine((value) => /^postgres(?:ql)?:\/\//.test(value));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().min(1).default('127.0.0.1'),
    APP_ORIGIN: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
      }),
    DATABASE_URL: postgresUrl,
    STORAGE_DRIVER: z.literal('local').default('local'),
    STORAGE_LOCAL_ROOT: z.string().min(1).default('./var/uploads'),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().max(20971520).default(20971520),
    SESSION_IDLE_HOURS: z.coerce.number().int().min(1).default(8),
    SESSION_ABSOLUTE_DAYS: z.coerce.number().int().min(1).default(7),
    INITIAL_ADMIN_EMAIL: z.string().email().optional(),
    INITIAL_ADMIN_PASSWORD: z.string().min(8).optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SWAGGER_ENABLED: booleanString.default(false),
    AI_ENABLED: booleanString.default(false),
    GITHUB_ENABLED: booleanString.default(false),
    AI_LLM_PROVIDER: z.literal('deepseek').default('deepseek'),
    DEEPSEEK_BASE_URL: z.literal('https://api.deepseek.com').default('https://api.deepseek.com'),
    AI_CHAT_MODEL: z.literal('deepseek-v4-pro').default('deepseek-v4-pro'),
  })
  .superRefine((value, context) => {
    // Fail honestly rather than advertising providers that are not implemented yet.
    for (const key of ['AI_ENABLED', 'GITHUB_ENABLED'] as const) {
      if (value[key])
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'Available in Phase 2, not this foundation.',
        });
    }
    if (value.NODE_ENV === 'production' && value.SWAGGER_ENABLED) {
      context.addIssue({
        code: 'custom',
        path: ['SWAGGER_ENABLED'],
        message: 'Public documentation must be disabled in production.',
      });
    }
  });

export type Environment = z.infer<typeof schema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    // Values and Zod's raw error are deliberately omitted: input may contain secrets.
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }
  return parsed.data;
}
