import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { Session } from '../auth/entities/session.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { PasswordService } from '../auth/services/password.service';
import { SessionService } from '../auth/services/session.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session, WorkspaceInvitation])],
  controllers: [UsersController, WorkspaceController],
  providers: [UsersService, WorkspaceInvitationsService, PasswordService, SessionService],
  exports: [UsersService, WorkspaceInvitationsService, TypeOrmModule],
})
export class UsersModule {}
