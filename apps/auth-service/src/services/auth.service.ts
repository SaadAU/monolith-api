import {
  Injectable,
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User, UserRole } from '@modules/users/entities/user.entity';
import { Org } from '@modules/orgs/entities/org.entity';
import {
  LoginRequestDto,
  SignupRequestDto,
  AuthResponseDto,
  AuthUserDto,
} from '@shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Org)
    private orgsRepository: Repository<Org>,
    private jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupRequestDto): Promise<AuthResponseDto> {
    try {
      // Check if user already exists
      const existingUser = await this.usersRepository.findOne({
        where: { email: signupDto.email },
      });

      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      // Get or create default org
      let org = await this.orgsRepository.findOne({
        where: { name: 'default-org' },
      });

      if (!org) {
        org = this.orgsRepository.create({
          name: 'default-org',
          slug: 'default-org',
          description: 'Default organization',
        });
        await this.orgsRepository.save(org);
      }

      // Hash password
      const hashedPassword = await argon2.hash(signupDto.password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });

      // Create user
      const user = this.usersRepository.create({
        email: signupDto.email,
        passwordHash: hashedPassword,
        name: signupDto.name || signupDto.email.split('@')[0],
        phone: signupDto.phone,
        role: UserRole.USER,
        orgId: org.id,
      });

      const savedUser = await this.usersRepository.save(user);
      this.logger.log(`User created: ${savedUser.email}`);

      // Generate JWT
      const token = this.jwtService.sign({
        sub: savedUser.id,
        email: savedUser.email,
        orgId: savedUser.orgId,
      });

      return {
        accessToken: token,
        user: this.mapUserToDto(savedUser),
      };
    } catch (error) {
      this.logger.error(
        'Signup error:',
        error instanceof Error ? error.message : String(error),
      );
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException('Signup failed');
    }
  }

  async login(loginDto: LoginRequestDto): Promise<AuthResponseDto> {
    try {
      const user = await this.usersRepository.findOne({
        where: { email: loginDto.email },
        select: [
          'id',
          'email',
          'name',
          'phone',
          'passwordHash',
          'role',
          'orgId',
          'isActive',
          'createdAt',
          'updatedAt',
        ],
      });

      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User account is inactive');
      }

      // Verify password
      const isPasswordValid = await argon2.verify(
        user.passwordHash,
        loginDto.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Generate JWT
      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        orgId: user.orgId,
      });

      this.logger.log(`User logged in: ${user.email}`);

      return {
        accessToken: token,
        user: this.mapUserToDto(user),
      };
    } catch (error) {
      this.logger.error(
        'Login error:',
        error instanceof Error ? error.message : String(error),
      );
      throw error instanceof UnauthorizedException
        ? error
        : new BadRequestException('Login failed');
    }
  }

  validateToken(token: string): { valid: boolean; data?: any } {
    try {
      const decoded: unknown = this.jwtService.verify(token);
      return { valid: true, data: decoded as any };
    } catch (error) {
      this.logger.debug(
        'Token validation failed:',
        error instanceof Error ? error.message : String(error),
      );
      return { valid: false };
    }
  }

  async getUser(userId: string): Promise<AuthUserDto> {
    try {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      return this.mapUserToDto(user);
    } catch (error) {
      this.logger.error(
        'Get user error:',
        error instanceof Error ? error.message : String(error),
      );
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException('Failed to fetch user');
    }
  }

  private mapUserToDto(user: User): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || undefined,
      orgId: user.orgId,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
