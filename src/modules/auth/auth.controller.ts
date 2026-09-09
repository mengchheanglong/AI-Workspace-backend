import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './services/session.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentSession } from '../../common/decorators/current-session.decorator';
import { User } from '../users/entities/user.entity';
import { Session } from './entities/session.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Public()
  @UseGuards(SessionAuthGuard)
  @Get('csrf')
  @ApiOperation({ summary: 'Bootstrap or retrieve CSRF token' })
  @ApiOkResponse({ description: 'CSRF token returned' })
  async getCsrfToken(@CurrentSession() session: Session | null) {
    if (session) {
      const csrfToken = await this.sessionService.rotateCsrfToken(session);
      return { data: { csrfToken } };
    }
    // Return a bootstrap token for unauthenticated visitors
    return { data: { csrfToken: null } };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with credentials and obtain session cookie' })
  @ApiOkResponse({ description: 'Login successful, returns profile and CSRF token' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or deactivated account' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { user, rawToken, rawCsrfToken } = await this.authService.login(dto);

    const cookieName = this.sessionService.getCookieName();
    const cookieOptions = this.sessionService.getCookieOptions();

    response.cookie(cookieName, rawToken, cookieOptions);

    return {
      data: {
        user: UserResponseDto.fromEntity(user),
        csrfToken: rawCsrfToken,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Log out and revoke current session' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiNoContentResponse({ description: 'Session revoked successfully' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = request.rawSessionToken;
    await this.authService.logout(rawToken);

    const cookieName = this.sessionService.getCookieName();
    response.clearCookie(cookieName, { path: '/' });
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiOkResponse({ description: 'Current user profile' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getProfile(@CurrentUser() user: User) {
    return {
      data: UserResponseDto.fromEntity(user),
    };
  }

  @Patch('password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Change password for current user' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiOkResponse({ description: 'Password updated successfully' })
  async changePassword(
    @CurrentUser() user: User,
    @CurrentSession() session: Session,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, session?.id, dto);
    return {
      data: { status: 'ok' },
    };
  }
}
