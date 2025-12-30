import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from '../../users/entities/user.entity';
import { Org } from '../../orgs/entities/org.entity';
import { SignupDto } from '../dto/signup.dto';
import { LoginDto } from '../dto/login.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  orgId: string;
  role: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: string;
  isActive: boolean;
  phone?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Org)
    private orgsRepository: Repository<Org>,
    private jwtService: JwtService,
  ) {}

  /**
   * Hash a password using Argon2id
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify a password against its hash
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Register a new user
   */
  async signup(signupDto: SignupDto): Promise<AuthenticatedUser> {
    // Verify organization exists
    const org = await this.orgsRepository.findOne({
      where: { id: signupDto.orgId },
    });

    if (!org) {
      throw new BadRequestException(
        `Organization with ID '${signupDto.orgId}' does not exist`,
      );
    }

    // Check if email already exists in this org
    const existingUser = await this.usersRepository.findOne({
      where: { email: signupDto.email, orgId: signupDto.orgId },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with email '${signupDto.email}' already exists in this organization`,
      );
    }

    // Hash password with Argon2
    const passwordHash = await this.hashPassword(signupDto.password);

    // Create user
    const user = this.usersRepository.create({
      name: signupDto.name,
      email: signupDto.email,
      passwordHash,
      phone: signupDto.phone,
      role: signupDto.role,
      orgId: signupDto.orgId,
    });

    const savedUser = await this.usersRepository.save(user);

    return this.sanitizeUser(savedUser);
  }

  /**
   * Authenticate user with email and password
   */
  async login(loginDto: LoginDto): Promise<AuthenticatedUser> {
    // Find user with password hash (normally excluded from queries)
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: loginDto.email })
      .andWhere('user.orgId = :orgId', { orgId: loginDto.orgId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(
      user.passwordHash,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await this.usersRepository.save(user);

    return this.sanitizeUser(user);
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(user: AuthenticatedUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      orgId: user.orgId,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Validate JWT payload and return user
   */
  async validateJwtPayload(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  /**
   * Get user by ID (for /me endpoint)
   */
  async getUserById(userId: string): Promise<AuthenticatedUser> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['org'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    return this.sanitizeUser(user);
  }

  /**
   * Remove sensitive fields from user object
   */
  private sanitizeUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      orgId: user.orgId,
      role: user.role,
      isActive: user.isActive,
      phone: user.phone,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
