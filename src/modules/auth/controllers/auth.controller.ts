import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { SignupDto, LoginDto, AuthResponseDto, LogoutResponseDto, UserResponseDto } from '../dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    path: string;
  };

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    const isProduction = this.configService.get<string>('environment') === 'production';
    const jwtExpiresIn = this.configService.get<number>('jwt.expiresIn') || 86400; // 24 hours default

    this.cookieOptions = {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: isProduction, // Only send over HTTPS in production
      sameSite: 'strict', // CSRF protection
      maxAge: jwtExpiresIn * 1000, // Convert to milliseconds
      path: '/',
    };
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed or organization not found' })
  @ApiConflictResponse({ description: 'Email already exists in organization' })
  async signup(
    @Body() signupDto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const user = await this.authService.signup(signupDto);
    const accessToken = this.authService.generateAccessToken(user);

    // Set JWT in HTTP-only cookie
    res.cookie('access_token', accessToken, this.cookieOptions);

    return {
      message: 'User successfully registered',
      user: user as UserResponseDto,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and get access token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or account deactivated' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const user = await this.authService.login(loginDto);
    const accessToken = this.authService.generateAccessToken(user);

    // Set JWT in HTTP-only cookie
    res.cookie('access_token', accessToken, this.cookieOptions);

    return {
      message: 'Login successful',
      user: user as UserResponseDto,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user and clear access token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logout successful',
    type: LogoutResponseDto,
  })
  async logout(@Res({ passthrough: true }) res: Response): Promise<LogoutResponseDto> {
    // Clear the access token cookie
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: this.cookieOptions.secure,
      sameSite: this.cookieOptions.sameSite,
      path: '/',
    });

    return {
      message: 'Logout successful',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns current user information',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated or invalid token' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    // Get fresh user data from database
    const freshUser = await this.authService.getUserById(user.id);
    return freshUser as UserResponseDto;
  }
}
