import { ApiProperty } from '@nestjs/swagger';
import { ProfessionalRole, SystemRole, User } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id!: string;

  @ApiProperty({ example: 'user@workspace.local' })
  email!: string;

  @ApiProperty({ example: 'Alice Smith' })
  displayName!: string;

  @ApiProperty({ enum: SystemRole, example: SystemRole.USER })
  systemRole!: SystemRole;

  @ApiProperty({ enum: ProfessionalRole, example: ProfessionalRole.DEVELOPER })
  professionalRole!: ProfessionalRole;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  mustChangePassword!: boolean;

  @ApiProperty({ example: '2026-09-08T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-08T10:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      systemRole: user.systemRole,
      professionalRole: user.professionalRole,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
      updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
    };
  }
}
