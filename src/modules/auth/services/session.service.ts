import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions } from 'express';
import { Session } from '../entities/session.entity';
import { User } from '../../users/entities/user.entity';
import { Environment } from '../../../config/environment';

export interface CreatedSession {
  session: Session;
  rawToken: string;
  rawCsrfToken: string;
}

export interface ValidatedSession {
  session: Session;
  user: User;
}

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  static hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async createSession(userId: string): Promise<CreatedSession> {
    const rawToken = randomBytes(32).toString('base64url');
    const rawCsrfToken = randomBytes(32).toString('base64url');

    const tokenHash = SessionService.hashToken(rawToken);
    const csrfTokenHash = SessionService.hashToken(rawCsrfToken);

    const now = new Date();
    const idleHours = this.configService.get('SESSION_IDLE_HOURS', { infer: true });
    const absoluteDays = this.configService.get('SESSION_ABSOLUTE_DAYS', { infer: true });

    const expiresAt = new Date(now.getTime() + idleHours * 60 * 60 * 1000);
    const absoluteExpiresAt = new Date(now.getTime() + absoluteDays * 24 * 60 * 60 * 1000);

    const session = this.sessionRepository.create({
      userId,
      tokenHash,
      csrfTokenHash,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      absoluteExpiresAt,
      revokedAt: null,
    });

    const saved = await this.sessionRepository.save(session);
    return { session: saved, rawToken, rawCsrfToken };
  }

  async validateSession(rawToken: string): Promise<ValidatedSession | null> {
    const tokenHash = SessionService.hashToken(rawToken);
    const now = new Date();

    const session = await this.sessionRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!session || session.revokedAt !== null) {
      return null;
    }

    if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      return null;
    }

    if (!session.user || !session.user.isActive) {
      return null;
    }

    // Touch idle expiration (sliding window bounded by absoluteExpiresAt)
    const idleHours = this.configService.get('SESSION_IDLE_HOURS', { infer: true });
    const nextIdleExpiry = new Date(now.getTime() + idleHours * 60 * 60 * 1000);
    session.lastSeenAt = now;
    session.expiresAt =
      nextIdleExpiry < session.absoluteExpiresAt ? nextIdleExpiry : session.absoluteExpiresAt;

    await this.sessionRepository.save(session);

    return { session, user: session.user };
  }

  async revokeSession(rawToken: string): Promise<void> {
    const tokenHash = SessionService.hashToken(rawToken);
    await this.sessionRepository.update({ tokenHash }, { revokedAt: new Date() });
  }

  async revokeSessionById(sessionId: string): Promise<void> {
    await this.sessionRepository.update({ id: sessionId }, { revokedAt: new Date() });
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const query = this.sessionRepository
      .createQueryBuilder()
      .update(Session)
      .set({ revokedAt: new Date() })
      .where('userId = :userId AND revokedAt IS NULL', { userId });

    if (exceptSessionId) {
      query.andWhere('id != :exceptSessionId', { exceptSessionId });
    }

    await query.execute();
  }

  async rotateCsrfToken(session: Session): Promise<string> {
    const rawCsrfToken = randomBytes(32).toString('base64url');
    session.csrfTokenHash = SessionService.hashToken(rawCsrfToken);
    await this.sessionRepository.save(session);
    return rawCsrfToken;
  }

  verifyCsrfToken(session: Session, rawCsrfToken: string): boolean {
    if (!rawCsrfToken || !session.csrfTokenHash) {
      return false;
    }
    const incomingHash = SessionService.hashToken(rawCsrfToken);
    const expectedBuffer = Buffer.from(session.csrfTokenHash, 'utf8');
    const incomingBuffer = Buffer.from(incomingHash, 'utf8');

    if (expectedBuffer.length !== incomingBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, incomingBuffer);
  }

  getCookieName(): string {
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    return nodeEnv === 'production' ? '__Host-aiws_session' : 'aiws_session';
  }

  getCookieOptions(): CookieOptions {
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    const isProd = nodeEnv === 'production';
    const absoluteDays = this.configService.get('SESSION_ABSOLUTE_DAYS', { infer: true });

    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: absoluteDays * 24 * 60 * 60 * 1000,
    };
  }
}
