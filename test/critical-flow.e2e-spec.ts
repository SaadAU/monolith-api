import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { EventStatus } from '../src/modules/events/entities/event.entity';

/**
 * Critical Flow E2E Test
 *
 * Tests the complete happy path a user takes through the system:
 * 1. Signup → 2. Login → 3. Create Event → 4. Submit Event → 5. Approve Event
 *
 * This test ensures the core user journey works end-to-end.
 * It hits real HTTP endpoints against a real test database.
 *
 * Definition of Done (Day 11):
 * - Critical flow is covered end-to-end
 * - Tests are deterministic (no flakiness)
 */
describe('Critical Flow E2E Test', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  // Test data - using unique IDs to avoid conflicts with other tests
  const testOrgId = 'cf0f0001-1111-4111-a111-111111111111';
  const moderatorId = 'cf0f0002-1111-4111-a111-111111111111';

  // Will be populated during test
  let userToken: string;
  let moderatorToken: string;
  let createdEventId: string;

  // Test user data
  const testUser = {
    name: 'Critical Flow User',
    email: `criticalflow-${Date.now()}@test.com`, // Unique email to avoid conflicts
    password: 'SecureP@ss123!',
    phone: '+1-555-123-4567',
    orgId: testOrgId,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
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

    // Setup prerequisite data (org and moderator)
    await setupTestData();
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create test organization
    await dataSource.query(
      `INSERT INTO orgs (id, name, slug, description, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET name = $2`,
      [
        testOrgId,
        'Critical Flow Test Org',
        'critical-flow-test-org',
        'Org for critical flow e2e tests',
      ],
    );

    // Create moderator user (needed for approval step)
    const modHash = await argon2.hash('ModeratorP@ss123!', {
      type: argon2.argon2id,
    });
    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET "passwordHash" = $4`,
      [
        moderatorId,
        'Critical Flow Moderator',
        'cfmod@test.com',
        modHash,
        'moderator',
        testOrgId,
      ],
    );

    // Get moderator token
    moderatorToken = await loginAndGetToken(
      'cfmod@test.com',
      'ModeratorP@ss123!',
    );
  }

  async function cleanupTestData() {
    try {
      if (!dataSource || !dataSource.isInitialized) {
        console.warn(
          'Cleanup skipped: DataSource not initialized or connection failed',
        );
        return;
      }

      // Clean up in correct order due to foreign keys
      await dataSource.query(`DELETE FROM events WHERE "orgId" = $1`, [
        testOrgId,
      ]);
      await dataSource.query(`DELETE FROM users WHERE "orgId" = $1`, [
        testOrgId,
      ]);
      await dataSource.query(`DELETE FROM orgs WHERE id = $1`, [testOrgId]);
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }

  async function loginAndGetToken(
    email: string,
    password: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, orgId: testOrgId });

    if (response.status !== 200) {
      throw new Error(
        `Login failed for ${email}: ${response.status} - ${JSON.stringify(response.body)}`,
      );
    }

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const accessTokenCookie = cookies?.find((c: string) =>
      c.startsWith('access_token='),
    );

    if (accessTokenCookie) {
      return accessTokenCookie.split(';')[0].split('=')[1];
    }

    throw new Error('No access token cookie returned');
  }

  // =============================================
  // CRITICAL FLOW: The Complete User Journey
  // =============================================

  describe('Complete User Journey', () => {
    // Step 1: User Signup
    it('Step 1: Should allow a new user to signup', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(201);

      expect(response.body.data).toMatchObject({
        email: testUser.email,
        name: testUser.name,
        role: 'user',
        isActive: true,
      });

      // Should NOT return password hash
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    // Step 2: User Login
    it('Step 2: Should allow the user to login', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          orgId: testUser.orgId,
        })
        .expect(200);

      expect(response.body.data.email).toBe(testUser.email);

      // Extract and store token for subsequent requests
      const cookies = response.headers['set-cookie'] as unknown as string[];
      const accessTokenCookie = cookies?.find((c: string) =>
        c.startsWith('access_token='),
      );
      expect(accessTokenCookie).toBeDefined();

      userToken = accessTokenCookie!.split(';')[0].split('=')[1];
    });

    // Step 3: Create Event
    it('Step 3: Should allow logged-in user to create an event', async () => {
      const eventData = {
        title: 'Critical Flow Test Event',
        description:
          'This event was created as part of the critical flow e2e test',
        location: 'Test Location',
        startDate: '2026-07-15T14:00:00Z',
        endDate: '2026-07-15T17:00:00Z',
        maxAttendees: 100,
        isVirtual: false,
      };

      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Cookie', `access_token=${userToken}`)
        .send(eventData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        status: EventStatus.DRAFT,
        isVirtual: false,
      });

      // Store event ID for subsequent steps
      createdEventId = response.body.data.id;
      expect(createdEventId).toBeDefined();
    });

    // Step 4: Submit Event for Moderation
    it('Step 4: Should allow event owner to submit event for moderation', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/${createdEventId}/submit`)
        .set('Cookie', `access_token=${userToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: createdEventId,
        status: EventStatus.SUBMITTED,
        previousStatus: EventStatus.DRAFT,
      });
      expect(response.body.data.message).toContain('submitted');
    });

    // Step 5: Moderator Approves Event
    it('Step 5: Should allow moderator to approve the submitted event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/${createdEventId}/approve`)
        .set('Cookie', `access_token=${moderatorToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: createdEventId,
        status: EventStatus.APPROVED,
        previousStatus: EventStatus.SUBMITTED,
      });
      expect(response.body.data.message).toContain('approved');
    });

    // Step 6: Verify Final State
    it('Step 6: Should verify the event is now publicly visible (approved)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${createdEventId}`)
        .set('Cookie', `access_token=${userToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: createdEventId,
        status: EventStatus.APPROVED,
        title: 'Critical Flow Test Event',
      });

      // Verify approval metadata
      expect(response.body.data.approvedAt).toBeDefined();
    });
  });

  // =============================================
  // ADDITIONAL CRITICAL PATHS
  // =============================================

  describe('Event Rejection and Resubmission Flow', () => {
    let rejectedEventId: string;

    it('Should create a new event for rejection flow', async () => {
      const eventData = {
        title: 'Event for Rejection Test',
        description: 'This event will be rejected and resubmitted',
        startDate: '2026-08-20T10:00:00Z',
        isVirtual: false,
      };

      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Cookie', `access_token=${userToken}`)
        .send(eventData)
        .expect(201);

      rejectedEventId = response.body.data.id;
    });

    it('Should submit the event for moderation', async () => {
      await request(app.getHttpServer())
        .post(`/moderation/${rejectedEventId}/submit`)
        .set('Cookie', `access_token=${userToken}`)
        .expect(200);
    });

    it('Should allow moderator to reject with reason', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/${rejectedEventId}/reject`)
        .set('Cookie', `access_token=${moderatorToken}`)
        .send({
          reason: 'Missing important details. Please add more information.',
        })
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: rejectedEventId,
        status: EventStatus.REJECTED,
        previousStatus: EventStatus.SUBMITTED,
        rejectionReason:
          'Missing important details. Please add more information.',
      });
    });

    it('Should allow owner to revert rejected event to draft', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/${rejectedEventId}/revert-to-draft`)
        .set('Cookie', `access_token=${userToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: rejectedEventId,
        status: EventStatus.DRAFT,
        previousStatus: EventStatus.REJECTED,
      });
    });

    it('Should allow resubmission after editing', async () => {
      // First update the event
      await request(app.getHttpServer())
        .patch(`/events/${rejectedEventId}`)
        .set('Cookie', `access_token=${userToken}`)
        .send({
          description: 'Updated with more detailed information as requested.',
        })
        .expect(200);

      // Then resubmit
      const response = await request(app.getHttpServer())
        .post(`/moderation/${rejectedEventId}/submit`)
        .set('Cookie', `access_token=${userToken}`)
        .expect(200);

      expect(response.body.data.status).toBe(EventStatus.SUBMITTED);
    });
  });

  // =============================================
  // AUTHENTICATION & AUTHORIZATION VERIFICATION
  // =============================================

  describe('Security Checks in Critical Flow', () => {
    it('Should not allow unauthenticated event creation', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'Unauthorized Event',
          startDate: '2026-09-01T10:00:00Z',
        })
        .expect(401);
    });

    it('Should not allow regular user to approve events', async () => {
      // Create and submit a test event
      const eventRes = await request(app.getHttpServer())
        .post('/events')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          title: 'User Approval Attempt Event',
          startDate: '2026-09-15T10:00:00Z',
        })
        .expect(201);

      const eventId = eventRes.body.data.id;

      // Submit it
      await request(app.getHttpServer())
        .post(`/moderation/${eventId}/submit`)
        .set('Cookie', `access_token=${userToken}`)
        .expect(200);

      // Try to approve as regular user (should fail)
      await request(app.getHttpServer())
        .post(`/moderation/${eventId}/approve`)
        .set('Cookie', `access_token=${userToken}`)
        .expect(403);
    });
  });
});
