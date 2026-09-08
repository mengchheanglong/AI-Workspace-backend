import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthService } from './health.service';

class HealthStatusDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}
class HealthResponseDto {
  @ApiProperty({ type: HealthStatusDto })
  data!: HealthStatusDto;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @ApiOkResponse({ type: HealthResponseDto, description: 'Process is running.' })
  live(): HealthResponseDto {
    return { data: { status: 'ok' } };
  }

  @Get('ready')
  @ApiOkResponse({
    type: HealthResponseDto,
    description: 'Database and local storage are available.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Required dependency unavailable; no private details returned.',
  })
  ready(): Promise<HealthResponseDto> {
    return this.health.ready();
  }
}
