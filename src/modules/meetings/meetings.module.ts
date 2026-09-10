import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingAttendee } from './entities/meeting-attendee.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { User } from '../users/entities/user.entity';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Meeting, MeetingAttendee, Project, ProjectMember, User])],
  controllers: [MeetingsController],
  providers: [MeetingsService, ProjectPolicyGuard],
  exports: [MeetingsService, TypeOrmModule],
})
export class MeetingsModule {}
