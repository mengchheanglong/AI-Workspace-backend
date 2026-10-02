import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { ProfessionalRole, SystemRole } from '../entities/user.entity';

export class CreateInvitationDto {
  @ApiProperty({
    example: 'colleague@example.com',
    description: 'Email address of person to invite',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email address is required' })
  email!: string;

  @ApiPropertyOptional({ enum: SystemRole, default: SystemRole.USER })
  @IsOptional()
  @IsEnum(SystemRole, { message: 'Invalid system role' })
  systemRole?: SystemRole;

  @ApiPropertyOptional({ enum: ProfessionalRole, default: ProfessionalRole.DEVELOPER })
  @IsOptional()
  @IsEnum(ProfessionalRole, { message: 'Invalid professional role' })
  professionalRole?: ProfessionalRole;
}
