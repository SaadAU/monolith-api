import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';

/**
 * E2E Tests for Role-Based Access Control (RBAC)
 *
 * Tests cover:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: Valid token but insufficient role permissions
 * - 200/201 Success: Valid token with correct role
 */
describe('RBAC Authorization (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  // Test org and user IDs - use valid UUID v4 format (only hex digits allowed)
  const testOrgId = 'e2e11111-1111-4111-a111-111111111111';
  const adminUserId = '02ead011-1111-4111-a111-111111111111';
  const moderatorUserId = '0e2ed011-1111-4111-a111-111111111111';
  const regularUserId = '0e2e5e01-1111-4111-a111-111111111111';

  // JWT tokens for different roles
  let adminToken: string;
  let moderatorToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same pipes as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // Setup test data
    await setupTestData();

    // Get tokens for each role
    adminToken = await loginAndGetToken('admin@e2etest.com', 'Admin123!');
    moderatorToken = await loginAndGetToken(
      'moderator@e2etest.com',
      'Moderator123!',
    );
    userToken = await loginAndGetToken('user@e2etest.com', 'User123!');
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create test organization
    await dataSource.query(
      `INSERT INTO orgs (id, name, slug, description, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        testOrgId,
        'E2E Test Org',
        'e2e-test-org',
        'Organization for RBAC e2e tests',
      ],
    );

    // Hash passwords using argon2
    const adminHash = await argon2.hash('Admin123!', { type: argon2.argon2id });
    const moderatorHash = await argon2.hash('Moderator123!', {
      type: argon2.argon2id,
    });
    const userHash = await argon2.hash('User123!', { type: argon2.argon2id });

    // Create admin user
    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        adminUserId,
        'E2E Admin',
        'admin@e2etest.com',
        adminHash,
        'admin',
        testOrgId,
      ],
    );

    // Create moderator user
    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        moderatorUserId,
        'E2E Moderator',
        'moderator@e2etest.com',
        moderatorHash,
        'moderator',
        testOrgId,
      ],
    );

    // Create regular user
    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        regularUserId,
        'E2E User',
        'user@e2etest.com',
        userHash,
        'user',
        testOrgId,
      ],
    );
  }

  async function cleanupTestData() {
    // Delete test users first (due to FK constraint)
    await dataSource.query(`DELETE FROM users WHERE "orgId" = $1`, [testOrgId]);
    // Delete test organization
    await dataSource.query(`DELETE FROM orgs WHERE id = $1`, [testOrgId]);
  }

  async function loginAndGetToken(
    email: string,
    password: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, orgId: testOrgId })
      .expect(200);

    // Extract token from cookie
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const accessTokenCookie = cookies?.find((c: string) =>
      c.startsWith('access_token='),
    );

    if (accessTokenCookie) {
      const token = accessTokenCookie.split(';')[0].split('=')[1];
      return token;
    }

    throw new Error('No access token cookie returned');
  }

  // ===========================================
  // 401 UNAUTHORIZED TESTS
  // ===========================================
  describe('401 Unauthorized - Missing/Invalid Token', () => {
    it('should return 401 when no token is provided for protected route', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
      expect(response.body.statusCode).toBe(401);
    });

    it('should return 401 when invalid token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer invalid-token-12345')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return 401 when malformed Authorization header is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return 401 when expired token is used', async () => {
      // This is a manually crafted expired token (payload has exp in the past)
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.INVALID';

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return 401 for POST /users without token', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123!',
          orgId: testOrgId,
        })
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });

    it('should return 401 for DELETE /users/:id without token', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/users/${regularUserId}`)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });

    it('should return 401 for POST /orgs without token', async () => {
      const response = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Test Org',
          slug: 'test-org-unauthorized',
        })
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });
  });

  // ===========================================
  // 403 FORBIDDEN TESTS
  // ===========================================
  describe('403 Forbidden - Insufficient Role', () => {
    describe('Admin-only routes', () => {
      it('should return 403 when regular user tries to create a user (admin-only)', async () => {
        const response = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: 'New User',
            email: 'newuser@e2etest.com',
            password: 'Password123!',
            orgId: testOrgId,
          })
          .expect(403);

        expect(response.body.message).toContain('Access denied');
        expect(response.body.statusCode).toBe(403);
      });

      it('should return 403 when moderator tries to create a user (admin-only)', async () => {
        const response = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({
            name: 'New User',
            email: 'newuser@e2etest.com',
            password: 'Password123!',
            orgId: testOrgId,
          })
          .expect(403);

        expect(response.body.message).toContain('Access denied');
      });

      it('should return 403 when regular user tries to delete a user (admin-only)', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/users/${moderatorUserId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.message).toContain('Access denied');
      });

      it('should return 403 when moderator tries to delete a user (admin-only)', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/users/${regularUserId}`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(403);

        expect(response.body.message).toContain('Access denied');
      });

      it('should return 403 when regular user tries to create an organization (admin-only)', async () => {
        const response = await request(app.getHttpServer())
          .post('/orgs')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: 'Forbidden Org',
            slug: 'forbidden-org',
          })
          .expect(403);

        expect(response.body.message).toContain('Access denied');
      });

      it('should return 403 when moderator tries to delete an organization (admin-only)', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/orgs/${testOrgId}`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(403);

        expect(response.body.message).toContain('Access denied');
      });
    });

    describe('Admin/Moderator routes', () => {
      it('should return 403 when regular user tries to list all users (admin/moderator only)', async () => {
        const response = await request(app.getHttpServer())
          .get('/users')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.message).toContain('Access denied');
      });

      it('should return 403 when regular user tries to update another user (admin/moderator only)', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/users/${moderatorUserId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ name: 'Hacked Name' })
          .expect(403);

        expect(response.body.message).toContain('Access denied');
      });

      it('should return 403 when regular user tries to deactivate a user (admin/moderator only)', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/users/${moderatorUserId}/deactivate`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.message).toContain('Access denied');
      });
    });
  });

  // ===========================================
  // SUCCESS TESTS - Proper Role Access
  // ===========================================
  describe('Success - Authorized Access', () => {
    describe('Admin access', () => {
      it('should allow admin to list all users', async () => {
        const response = await request(app.getHttpServer())
          .get('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should allow admin to create an organization', async () => {
        const response = await request(app.getHttpServer())
          .post('/orgs')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Admin Created Org',
            slug: 'admin-created-org-' + Date.now(),
          })
          .expect(201);

        expect(response.body.name).toBe('Admin Created Org');

        // Cleanup
        await dataSource.query('DELETE FROM orgs WHERE id = $1', [
          response.body.id,
        ]);
      });

      it('should allow admin to update a user', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/users/${regularUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Updated By Admin' })
          .expect(200);

        expect(response.body.name).toBe('Updated By Admin');

        // Restore original name
        await dataSource.query('UPDATE users SET name = $1 WHERE id = $2', [
          'E2E User',
          regularUserId,
        ]);
      });

      it('should allow admin to view organization details', async () => {
        const response = await request(app.getHttpServer())
          .get(`/orgs/${testOrgId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.id).toBe(testOrgId);
      });
    });

    describe('Moderator access', () => {
      it('should allow moderator to list all users', async () => {
        const response = await request(app.getHttpServer())
          .get('/users')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should allow moderator to update a user', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/users/${regularUserId}`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ name: 'Updated By Moderator' })
          .expect(200);

        expect(response.body.name).toBe('Updated By Moderator');

        // Restore original name
        await dataSource.query('UPDATE users SET name = $1 WHERE id = $2', [
          'E2E User',
          regularUserId,
        ]);
      });

      it('should allow moderator to view organization details', async () => {
        const response = await request(app.getHttpServer())
          .get(`/orgs/${testOrgId}`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(200);

        expect(response.body.id).toBe(testOrgId);
      });
    });

    describe('Regular user access', () => {
      it('should allow regular user to get their own profile via /auth/me', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.email).toBe('user@e2etest.com');
        expect(response.body.role).toBe('user');
      });

      it('should allow regular user to view a specific user by ID', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/${regularUserId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.id).toBe(regularUserId);
      });

      it('should allow regular user to view organizations', async () => {
        const response = await request(app.getHttpServer())
          .get('/orgs')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  // ===========================================
  // Cookie-based Authentication Tests
  // ===========================================
  describe('Cookie-based Authentication', () => {
    it('should accept authentication via Authorization header', async () => {
      // Note: Cookie authentication is tested implicitly through login flow
      // For supertest, we use Authorization header which is equivalent
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.email).toBe('admin@e2etest.com');
    });

    it('should return 401 when cookie contains invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', 'access_token=invalid-token')
        .expect(401);
    });
  });

  // ===========================================
  // Role Hierarchy Tests
  // ===========================================
  describe('Role Hierarchy Verification', () => {
    it('admin should have higher privilege than moderator', async () => {
      // Admin can create user
      const createResponse = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Hierarchy User',
          email: 'hierarchy-test@e2etest.com',
          password: 'Password123!',
          orgId: testOrgId,
        });

      expect(createResponse.status).toBe(201);

      // Moderator cannot create user
      const modResponse = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          name: 'Another Test User',
          email: 'another-test@e2etest.com',
          password: 'Password123!',
          orgId: testOrgId,
        });

      expect(modResponse.status).toBe(403);

      // Cleanup
      await dataSource.query(
        "DELETE FROM users WHERE email = 'hierarchy-test@e2etest.com'",
      );
    });

    it('moderator should have higher privilege than regular user', async () => {
      // Moderator can list users
      const modResponse = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(Array.isArray(modResponse.body)).toBe(true);

      // Regular user cannot list users
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
