import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ProfessionalRole, SystemRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'user@workspace.local' })
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiProperty({ example: 'Alice Smith' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;

  @ApiProperty({ enum: SystemRole, default: SystemRole.USER })
  @IsEnum(SystemRole)
  systemRole: SystemRole = SystemRole.USER;

  @ApiProperty({ enum: ProfessionalRole, default: ProfessionalRole.DEVELOPER })
  @IsEnum(ProfessionalRole)
  professionalRole: ProfessionalRole = ProfessionalRole.DEVELOPER;

  @ApiPropertyOptional({
    description: 'Initial password. If omitted, a temporary random password will be generated.',
    example: 'InitialPass123!',
    minLength: 8,
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}

export class CreateUserResponseDto extends CreateUserDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id!: string;

  @ApiPropertyOptional({
    description: 'Generated temporary password if no password was supplied at creation.',
    example: 'K8s_temp-pass_x9',
  })
  temporaryPassword?: string;
}
