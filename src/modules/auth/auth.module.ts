import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { SystemRolesGuard } from '../../common/guards/system-roles.guard';
import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Session]), UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    SessionAuthGuard,
    CsrfGuard,
    SystemRolesGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    SessionService,
    SessionAuthGuard,
    CsrfGuard,
    SystemRolesGuard,
  ],
})
export class AuthModule {}
