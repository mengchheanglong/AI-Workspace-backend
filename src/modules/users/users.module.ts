import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Session } from '../auth/entities/session.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PasswordService } from '../auth/services/password.service';
import { SessionService } from '../auth/services/session.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [UsersController],
  providers: [UsersService, PasswordService, SessionService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
