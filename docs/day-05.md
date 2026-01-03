# Day 5: Authentication - Signup, Login, and /me

**Date:** December 30, 2025

## Objective

Implement a complete authentication system with signup/login endpoints, secure password hashing using Argon2, JWT access tokens stored in HTTP-only cookies (XSS-safe), and a protected `/me` endpoint.

## What Was Done

### 1. Dependencies Installed

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt argon2 cookie-parser
npm install -D @types/passport-jwt @types/cookie-parser
```

### 2. Configuration Updated

**File:** `src/config/configuration.ts`

Added JWT configuration with environment variable support:

```typescript
export default () => ({
  // ... existing config
  jwt: {
    secret: process.env.JWT_SECRET ?? 'your-super-secret-key-change-in-production-min-32-chars',
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '86400', 10), // 24 hours in seconds
  },
});
```

### 3. Signup/Login DTOs with Validation

**File:** `src/modules/auth/dto/signup.dto.ts`

```typescript
export class SignupDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z\s'-]+$/, { message: 'Name can only contain letters, spaces, hyphens and apostrophes' })
  name!: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255, { message: 'Email cannot exceed 255 characters' })
  email!: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100, { message: 'Password cannot exceed 100 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsNotEmpty({ message: 'Organization ID is required' })
  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  orgId!: string;
}
```

**File:** `src/modules/auth/dto/login.dto.ts`

```typescript
export class LoginDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  email!: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MaxLength(100)
  password!: string;

  @IsNotEmpty({ message: 'Organization ID is required' })
  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  orgId!: string;
}
```

### 4. AuthService with Argon2 Password Hashing

**File:** `src/modules/auth/services/auth.service.ts`

Key features:
- **Argon2id** algorithm for password hashing (most secure variant)
- Configurable memory cost (64 MB), time cost (3 iterations), parallelism (4)
- Secure password verification
- JWT token generation
- User validation

```typescript
@Injectable()
export class AuthService {
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
    // Check if email already exists in this org
    // Hash password with Argon2
    // Create and save user
  }

  /**
   * Authenticate user with email and password
   */
  async login(loginDto: LoginDto): Promise<AuthenticatedUser> {
    // Find user with password hash
    // Verify password
    // Update last login timestamp
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
}
```

### 5. JWT Strategy with Cookie Support

**File:** `src/modules/auth/strategies/jwt.strategy.ts`

Extracts JWT from HTTP-only cookie first, then falls back to Bearer token:

```typescript
const cookieExtractor = (req: Request): string | null => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies['access_token'];
  }
  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateJwtPayload(payload);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
```

### 6. JwtAuthGuard

**File:** `src/modules/auth/guards/jwt-auth.guard.ts`

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser, _info: Error | null): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
```

### 7. CurrentUser Decorator

**File:** `src/modules/auth/decorators/current-user.decorator.ts`

```typescript
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return data ? user[data] : user;
  },
);
```

### 8. AuthController with HTTP-Only Cookie JWT

**File:** `src/modules/auth/controllers/auth.controller.ts`

Key security features:
- **HTTP-only cookies**: JWT cannot be accessed via JavaScript (XSS protection)
- **Secure flag**: Cookie only sent over HTTPS in production
- **SameSite=strict**: CSRF protection
- **Configurable expiry**: Matches JWT token expiry

```typescript
@Controller('auth')
export class AuthController {
  private readonly cookieOptions = {
    httpOnly: true,      // Prevents JavaScript access (XSS protection)
    secure: isProduction, // Only send over HTTPS in production
    sameSite: 'strict',   // CSRF protection
    maxAge: jwtExpiresIn * 1000,
    path: '/',
  };

  @Post('signup')
  async signup(@Body() signupDto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.signup(signupDto);
    const accessToken = this.authService.generateAccessToken(user);
    res.cookie('access_token', accessToken, this.cookieOptions);
    return { message: 'User successfully registered', user };
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.login(loginDto);
    const accessToken = this.authService.generateAccessToken(user);
    res.cookie('access_token', accessToken, this.cookieOptions);
    return { message: 'Login successful', user };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { ... });
    return { message: 'Logout successful' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getUserById(user.id);
  }
}
```

### 9. Auth Module

**File:** `src/modules/auth/auth.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Org]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<number>('jwt.expiresIn') || 86400,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
```

### 10. Unit Tests for AuthService

**File:** `src/modules/auth/services/auth.service.spec.ts`

22 comprehensive unit tests covering:

| Test Suite | Tests |
|------------|-------|
| `hashPassword` | Hash generation, uniqueness (salt) |
| `verifyPassword` | Correct password, wrong password, invalid hash |
| `signup` | Success, org not found, email conflict, password hashing |
| `login` | Success, user not found, wrong password, deactivated user, lastLoginAt update |
| `generateAccessToken` | JWT generation with correct payload |
| `validateJwtPayload` | Valid payload, user not found, deactivated user |
| `getUserById` | Success, user not found, deactivated user |

```bash
npm test -- --testPathPatterns=auth.service.spec.ts

# Results:
PASS  src/modules/auth/services/auth.service.spec.ts
  AuthService
    ✓ should be defined
    hashPassword
      ✓ should hash a password using Argon2
      ✓ should produce different hashes for the same password (due to salt)
    verifyPassword
      ✓ should return true for correct password
      ✓ should return false for incorrect password
      ✓ should return false for invalid hash format
    signup
      ✓ should successfully create a new user
      ✓ should throw BadRequestException if organization does not exist
      ✓ should throw ConflictException if email already exists in org
      ✓ should hash the password before saving
    login
      ✓ should successfully login a user with correct credentials
      ✓ should throw UnauthorizedException for non-existent user
      ✓ should throw UnauthorizedException for incorrect password
      ✓ should throw UnauthorizedException for deactivated user
      ✓ should update lastLoginAt on successful login
    generateAccessToken
      ✓ should generate a JWT token
    validateJwtPayload
      ✓ should return user for valid payload
      ✓ should return null for non-existent user
      ✓ should return null for deactivated user
    getUserById
      ✓ should return user by ID
      ✓ should throw UnauthorizedException for non-existent user
      ✓ should throw UnauthorizedException for deactivated user

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
```

## API Endpoints

### POST /auth/signup

Register a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "phone": "+1-555-123-4567",
  "role": "member",
  "orgId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (201 Created):**
```json
{
  "message": "User successfully registered",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-123-4567",
    "role": "member",
    "orgId": "550e8400-e29b-41d4-a716-446655440000",
    "isActive": true,
    "createdAt": "2025-12-30T10:00:00.000Z",
    "updatedAt": "2025-12-30T10:00:00.000Z"
  }
}
```

**Response Headers:**
```
Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400
```

### POST /auth/login

Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123",
  "orgId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "John Doe",
    "email": "john@example.com",
    ...
  }
}
```

### POST /auth/logout

Logout user and clear access token.

**Response (200 OK):**
```json
{
  "message": "Logout successful"
}
```

### GET /auth/me (Protected)

Get current authenticated user.

**Headers:**
- Cookie: `access_token=<jwt>` (automatic) OR
- Authorization: `Bearer <jwt>`

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1-555-123-4567",
  "role": "member",
  "orgId": "550e8400-e29b-41d4-a716-446655440000",
  "isActive": true,
  "lastLoginAt": "2025-12-30T10:00:00.000Z",
  "createdAt": "2025-12-30T10:00:00.000Z",
  "updatedAt": "2025-12-30T10:00:00.000Z"
}
```

## Security Features

### Password Security (Argon2id)

| Parameter | Value | Description |
|-----------|-------|-------------|
| Algorithm | Argon2id | Hybrid algorithm, resistant to side-channel and GPU attacks |
| Memory Cost | 64 MB | Amount of memory used |
| Time Cost | 3 | Number of iterations |
| Parallelism | 4 | Degree of parallelism |

### JWT Cookie Security

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `httpOnly` | `true` | Prevents JavaScript access (XSS protection) |
| `secure` | `true` (prod) | Only send over HTTPS |
| `sameSite` | `strict` | CSRF protection |
| `maxAge` | 86400000ms | 24-hour expiry |
| `path` | `/` | Available for all routes |

### Why HTTP-only Cookies vs LocalStorage?

| Storage | XSS Vulnerable | CSRF Vulnerable | Recommended |
|---------|----------------|-----------------|-------------|
| LocalStorage | ✅ Yes | ❌ No | ❌ No |
| HTTP-only Cookie | ❌ No | ✅ Yes (mitigated with SameSite) | ✅ Yes |

## File Structure

```
src/modules/auth/
├── auth.module.ts
├── index.ts
├── controllers/
│   └── auth.controller.ts
├── decorators/
│   ├── current-user.decorator.ts
│   └── index.ts
├── dto/
│   ├── auth-response.dto.ts
│   ├── index.ts
│   ├── login.dto.ts
│   └── signup.dto.ts
├── guards/
│   ├── index.ts
│   └── jwt-auth.guard.ts
├── services/
│   ├── auth.service.spec.ts
│   └── auth.service.ts
└── strategies/
    ├── index.ts
    └── jwt.strategy.ts
```

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=86400  # 24 hours in seconds
```

## Definition of Done ✅

| Requirement | Status |
|-------------|--------|
| Signup and login work end-to-end | ✅ |
| /me returns user identity with valid token | ✅ |
| Passwords never stored in plain text (Argon2 hashing) | ✅ |
| AuthService has unit tests (22 tests) | ✅ |
| JWT stored in HTTP-only cookie (XSS protection) | ✅ |

## Testing the API

```bash
# Start the server
npm run start:dev

# 1. Signup a new user
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123",
    "orgId": "<your-org-id>"
  }'

# 2. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123",
    "orgId": "<your-org-id>"
  }'

# 3. Get current user (using cookie)
curl http://localhost:3000/auth/me -b cookies.txt

# 4. Logout
curl -X POST http://localhost:3000/auth/logout -b cookies.txt -c cookies.txt
```

## Next Steps (Day 6+)

- [ ] Implement refresh tokens for better security
- [ ] Add rate limiting for login attempts
- [ ] Implement password reset functionality
- [ ] Add email verification
- [ ] Implement role-based access control (RBAC)
