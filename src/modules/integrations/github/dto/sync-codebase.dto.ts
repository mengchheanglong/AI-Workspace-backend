import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
export class SyncCodebaseDto {
  @IsOptional() @IsUUID() connectionId?: string;
  @IsOptional() @IsString() accessToken?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) cursor = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) batchSize = 2;
  @IsOptional() @Matches(/^[a-f0-9]{64}$/) treeVersion?: string;
}
