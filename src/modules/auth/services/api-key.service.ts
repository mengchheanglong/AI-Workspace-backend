import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { ApiKey } from '../entities/api-key.entity';
import { User } from '../../users/entities/user.entity';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';

export const API_KEY_PREFIX = 'aiw_pat_';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createKey(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ apiKey: ApiKey; rawToken: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });
    if (!user) {
      throw new BadRequestException({
        code: 'USER_NOT_FOUND',
        message: 'Active user required to create an API key.',
      });
    }

    const randomSuffix = randomBytes(24).toString('hex');
    const rawToken = `${API_KEY_PREFIX}${randomSuffix}`;
    const keyHash = this.hashToken(rawToken);
    const keyPrefix = `${API_KEY_PREFIX}${randomSuffix.slice(0, 8)}`;

    let expiresAt: Date | null = null;
    if (dto.expiresInDays && dto.expiresInDays > 0) {
      expiresAt = new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000);
    }

    const apiKey = this.apiKeyRepository.create({
      userId,
      name: dto.name.trim(),
      keyHash,
      keyPrefix,
      expiresAt,
      lastUsedAt: null,
      revokedAt: null,
    });

    const saved = await this.apiKeyRepository.save(apiKey);
    this.logger.log(`Created Personal Access Token [${saved.id}] for user ${userId}`);

    return { apiKey: saved, rawToken };
  }

  async listKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeKey(userId: string, keyId: string): Promise<void> {
    const key = await this.apiKeyRepository.findOne({
      where: { id: keyId, userId, revokedAt: IsNull() },
    });
    if (!key) {
      throw new NotFoundException({
        code: 'API_KEY_NOT_FOUND',
        message: 'Active API key not found.',
      });
    }

    key.revokedAt = new Date();
    await this.apiKeyRepository.save(key);
    this.logger.log(`Revoked Personal Access Token [${key.id}] for user ${userId}`);
  }

  async validateKey(rawToken: string): Promise<User | null> {
    if (!rawToken || !rawToken.startsWith(API_KEY_PREFIX) || rawToken.length < 20) {
      return null;
    }

    const keyHash = this.hashToken(rawToken);
    const key = await this.apiKeyRepository.findOne({
      where: { keyHash, revokedAt: IsNull() },
      relations: ['user'],
    });

    if (!key) {
      return null;
    }

    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
      return null;
    }

    if (!key.user || !key.user.isActive) {
      return null;
    }

    // Fire & forget update last_used_at
    this.apiKeyRepository
      .update(key.id, { lastUsedAt: new Date() })
      .catch((err) => this.logger.warn(`Failed to update lastUsedAt for key ${key.id}: ${err}`));

    return key.user;
  }
}
