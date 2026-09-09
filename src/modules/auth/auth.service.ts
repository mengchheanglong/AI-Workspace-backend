import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { PasswordService } from './services/password.service';
import { CreatedSession, SessionService } from './services/session.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '../users/entities/user.entity';

// Pre-computed hash to mitigate timing attacks on nonexistent accounts
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=1$w2N9GZ46l7m8V6Y7O6zPug$bT6bKzTfMqv8w6P7lO9yZfP9bKzTfMqv8w6P7lO9yZc';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
  ) {}

  async login(dto: LoginDto): Promise<{ user: User } & CreatedSession> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      // Constant-time check mitigation
      await this.passwordService.verify(DUMMY_HASH, dto.password);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    const isValid = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
    }

    const created = await this.sessionService.createSession(user.id);

    return {
      user,
      ...created,
    };
  }

  async logout(rawToken?: string): Promise<void> {
    if (rawToken) {
      await this.sessionService.revokeSession(rawToken);
    }
  }

  async changePassword(
    userId: string,
    currentSessionId: string | undefined,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    const isValid = await this.passwordService.verify(user.passwordHash, dto.currentPassword);
    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'The current password you entered is incorrect.',
      });
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_UNCHANGED',
        message: 'The new password must be different from the current password.',
      });
    }

    const newHash = await this.passwordService.hash(dto.newPassword);
    await this.usersService.updatePassword(user.id, newHash);

    // Invalidate all OTHER sessions for this user so only current session stays active
    await this.sessionService.revokeAllUserSessions(userId, currentSessionId);
  }
}
