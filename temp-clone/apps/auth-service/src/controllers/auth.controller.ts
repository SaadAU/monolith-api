import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type {
  LoginRequestDto,
  SignupRequestDto,
  ValidateTokenRequestDto,
  GetUserRequestDto,
} from '@shared';
import { AUTH_SERVICE_PATTERNS } from '@shared';
import { AuthService } from '../services/auth.service';

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_SERVICE_PATTERNS.LOGIN)
  async login(@Payload() data: LoginRequestDto) {
    this.logger.log(`Login attempt for email: ${data.email}`);
    return this.authService.login(data);
  }

  @MessagePattern(AUTH_SERVICE_PATTERNS.SIGNUP)
  async signup(@Payload() data: SignupRequestDto) {
    this.logger.log(`Signup attempt for email: ${data.email}`);
    return this.authService.signup(data);
  }

  @MessagePattern(AUTH_SERVICE_PATTERNS.VALIDATE_TOKEN)
  validateToken(@Payload() data: ValidateTokenRequestDto) {
    this.logger.log('Token validation request');
    return this.authService.validateToken(data.token);
  }

  @MessagePattern(AUTH_SERVICE_PATTERNS.GET_USER)
  async getUser(@Payload() data: GetUserRequestDto) {
    this.logger.log(`Get user request for userId: ${data.userId}`);
    return this.authService.getUser(data.userId);
  }
}
