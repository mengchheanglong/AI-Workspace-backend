import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConnectGitHubDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  repositoryOwner!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  repositoryName!: string;

  @IsString()
  @IsOptional()
  accessToken?: string;
}
