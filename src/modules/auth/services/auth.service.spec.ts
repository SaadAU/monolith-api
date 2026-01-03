import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole } from '../../users/entities/user.entity';
import { Org } from '../../orgs/entities/org.entity';
import { SignupDto } from '../dto/signup.dto';
import { LoginDto } from '../dto/login.dto';

describe('AuthService', () => {
  let service: AuthService;

  const mockOrg: Org = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Org',
    slug: 'test-org',
    description: 'Test organization',
    website: undefined,
    phone: undefined,
    address: undefined,
    isActive: true,
    users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$mockHash', // Mock Argon2 hash
    phone: '+1-555-123-4567',
    role: UserRole.MEMBER,
    orgId: '550e8400-e29b-41d4-a716-446655440000',
    org: mockOrg,
    isActive: true,
    lastLoginAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockOrgsRepository = {
    findOne: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
        {
          provide: getRepositoryToken(Org),
          useValue: mockOrgsRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hashPassword', () => {
    it('should hash a password using Argon2', async () => {
      const password = 'SecurePass123';
      const hash = await service.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$argon2id\$/); // Argon2id format
    });

    it('should produce different hashes for the same password (due to salt)', async () => {
      const password = 'SecurePass123';
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'SecurePass123';
      const hash = await service.hashPassword(password);

      const result = await service.verifyPassword(hash, password);

      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'SecurePass123';
      const hash = await service.hashPassword(password);

      const result = await service.verifyPassword(hash, 'WrongPassword123');

      expect(result).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const result = await service.verifyPassword('invalid-hash', 'password');

      expect(result).toBe(false);
    });
  });

  describe('signup', () => {
    const signupDto: SignupDto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'SecurePass123',
      phone: '+1-555-123-4567',
      orgId: '550e8400-e29b-41d4-a716-446655440000',
    };

    it('should successfully create a new user', async () => {
      mockOrgsRepository.findOne.mockResolvedValue(mockOrg);
      mockUsersRepository.findOne.mockResolvedValue(null);
      mockUsersRepository.create.mockReturnValue(mockUser);
      mockUsersRepository.save.mockResolvedValue(mockUser);

      const result = await service.signup(signupDto);

      expect(result).toBeDefined();
      expect(result.email).toBe(signupDto.email);
      expect(result.name).toBe(signupDto.name);
      expect(result).not.toHaveProperty('passwordHash');
      expect(mockOrgsRepository.findOne).toHaveBeenCalledWith({
        where: { id: signupDto.orgId },
      });
      expect(mockUsersRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if organization does not exist', async () => {
      mockOrgsRepository.findOne.mockResolvedValue(null);

      await expect(service.signup(signupDto)).rejects.toThrow(BadRequestException);
      await expect(service.signup(signupDto)).rejects.toThrow(
        `Organization with ID '${signupDto.orgId}' does not exist`,
      );
    });

    it('should throw ConflictException if email already exists in org', async () => {
      mockOrgsRepository.findOne.mockResolvedValue(mockOrg);
      mockUsersRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.signup(signupDto)).rejects.toThrow(ConflictException);
      await expect(service.signup(signupDto)).rejects.toThrow(
        `User with email '${signupDto.email}' already exists in this organization`,
      );
    });

    it('should hash the password before saving', async () => {
      mockOrgsRepository.findOne.mockResolvedValue(mockOrg);
      mockUsersRepository.findOne.mockResolvedValue(null);
      mockUsersRepository.create.mockImplementation((userData) => ({
        ...mockUser,
        ...userData,
      }));
      mockUsersRepository.save.mockImplementation(async (user) => user as User);

      await service.signup(signupDto);

      expect(mockUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: signupDto.email,
          passwordHash: expect.stringMatching(/^\$argon2id\$/),
        }),
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'john@example.com',
      password: 'SecurePass123',
      orgId: '550e8400-e29b-41d4-a716-446655440000',
    };

    it('should successfully login a user with correct credentials', async () => {
      const hashedPassword = await service.hashPassword(loginDto.password);
      const userWithHash = { ...mockUser, passwordHash: hashedPassword };

      const mockQueryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(userWithHash),
      };
      mockUsersRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockUsersRepository.save.mockResolvedValue({ ...userWithHash, lastLoginAt: new Date() });

      const result = await service.login(loginDto);

      expect(result).toBeDefined();
      expect(result.email).toBe(loginDto.email);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const mockQueryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockUsersRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid email or password');
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      const mockQueryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser), // Has wrong hash
      };
      mockUsersRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid email or password');
    });

    it('should throw UnauthorizedException for deactivated user', async () => {
      const deactivatedUser = { ...mockUser, isActive: false };
      const mockQueryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(deactivatedUser),
      };
      mockUsersRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('User account is deactivated');
    });

    it('should update lastLoginAt on successful login', async () => {
      const hashedPassword = await service.hashPassword(loginDto.password);
      const userWithHash = { ...mockUser, passwordHash: hashedPassword };

      const mockQueryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(userWithHash),
      };
      mockUsersRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockUsersRepository.save.mockResolvedValue(userWithHash);

      await service.login(loginDto);

      expect(mockUsersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }),
      );
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a JWT token', () => {
      const authenticatedUser = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        orgId: mockUser.orgId,
        role: mockUser.role,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      };

      mockJwtService.sign.mockReturnValue('mock.jwt.token');

      const token = service.generateAccessToken(authenticatedUser);

      expect(token).toBe('mock.jwt.token');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: authenticatedUser.id,
        email: authenticatedUser.email,
        orgId: authenticatedUser.orgId,
        role: authenticatedUser.role,
      });
    });
  });

  describe('validateJwtPayload', () => {
    const payload = {
      sub: mockUser.id,
      email: mockUser.email,
      orgId: mockUser.orgId,
      role: mockUser.role,
    };

    it('should return user for valid payload', async () => {
      mockUsersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateJwtPayload(payload);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUser.id);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should return null for non-existent user', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      const result = await service.validateJwtPayload(payload);

      expect(result).toBeNull();
    });

    it('should return null for deactivated user', async () => {
      mockUsersRepository.findOne.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await service.validateJwtPayload(payload);

      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      mockUsersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserById(mockUser.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserById('non-existent-id')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getUserById('non-existent-id')).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw UnauthorizedException for deactivated user', async () => {
      mockUsersRepository.findOne.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.getUserById(mockUser.id)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getUserById(mockUser.id)).rejects.toThrow(
        'User account is deactivated',
      );
    });
  });
});
