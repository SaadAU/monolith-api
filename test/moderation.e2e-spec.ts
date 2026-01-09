import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { EventStatus } from '../src/modules/events/entities/event.entity';

/**
 * E2E Tests for Moderation Workflow (State Transitions)
 *
 * Tests cover:
 * - Submit/Approve/Reject endpoints
 * - Allowed status transitions
 * - Invalid transitions return 400/409
 * - Role-based access (moderator/admin only for approve/reject)
 * - Ownership checks for submit
 * - Rejection reason validation
 */
describe('Moderation Workflow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  // Test org ID (using valid hex characters for UUID)
  const orgId = 'a0d0a001-1111-4111-a111-111111111111';

  // User IDs
  const regularUserId = 'a0d01001-1111-4111-a111-111111111111';
  const moderatorId = 'a0d02001-1111-4111-a111-111111111111';
  const adminId = 'a0d03001-1111-4111-a111-111111111111';
  const otherUserId = 'a0d04001-1111-4111-a111-111111111111';

  // Event IDs for different test scenarios
  const draftEventId = 'a0de1001-1111-4111-a111-111111111111';
  const submittedEventId = 'a0de2001-1111-4111-a111-111111111111';
  const approvedEventId = 'a0de3001-1111-4111-a111-111111111111';
  const rejectedEventId = 'a0de4001-1111-4111-a111-111111111111';
  const anotherDraftEventId = 'a0de5001-1111-4111-a111-111111111111';

  // JWT tokens
  let tokenRegularUser: string;
  let tokenModerator: string;
  let tokenAdmin: string;
  let tokenOtherUser: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable cookie-parser (required for JWT in cookies)
    app.use(cookieParser());

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

    // Cleanup any existing test data first
    await cleanupTestData();

    // Setup test data
    await setupTestData();

    // Verify setup completed
    const orgCheck = await dataSource.query(
      'SELECT id FROM orgs WHERE id = $1',
      [orgId],
    );
    if (orgCheck.length === 0) {
      throw new Error('Test org was not created');
    }

    // Get tokens
    tokenRegularUser = await loginAndGetToken(
      'moduser@test.com',
      'ModUserPass123!',
    );
    tokenModerator = await loginAndGetToken(
      'modmoderator@test.com',
      'ModModPass123!',
    );
    tokenAdmin = await loginAndGetToken(
      'modadmin@test.com',
      'ModAdminPass123!',
    );
    tokenOtherUser = await loginAndGetToken(
      'modother@test.com',
      'ModOtherPass123!',
    );
  }, 30000); // Increase timeout to 30 seconds

  afterAll(async () => {
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
        orgId,
        'Moderation Test Org',
        'moderation-test-org',
        'Org for moderation e2e tests',
      ],
    );

    // Hash passwords
    const hashUser = await argon2.hash('ModUserPass123!', {
      type: argon2.argon2id,
    });
    const hashMod = await argon2.hash('ModModPass123!', {
      type: argon2.argon2id,
    });
    const hashAdmin = await argon2.hash('ModAdminPass123!', {
      type: argon2.argon2id,
    });
    const hashOther = await argon2.hash('ModOtherPass123!', {
      type: argon2.argon2id,
    });

    // Create users with different roles
    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        regularUserId,
        'Regular User',
        'moduser@test.com',
        hashUser,
        'user',
        orgId,
      ],
    );

    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        moderatorId,
        'Moderator User',
        'modmoderator@test.com',
        hashMod,
        'moderator',
        orgId,
      ],
    );

    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [adminId, 'Admin User', 'modadmin@test.com', hashAdmin, 'admin', orgId],
    );

    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        otherUserId,
        'Other User',
        'modother@test.com',
        hashOther,
        'user',
        orgId,
      ],
    );

    // Create events in various states (owned by regularUserId)
    await dataSource.query(
      `INSERT INTO events (id, title, description, "startDate", status, "isVirtual", "orgId", "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        draftEventId,
        'Draft Event',
        'A draft event for testing',
        '2026-06-15T10:00:00Z',
        'draft',
        false,
        orgId,
        regularUserId,
      ],
    );

    await dataSource.query(
      `INSERT INTO events (id, title, description, "startDate", status, "isVirtual", "orgId", "createdById", "submittedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        submittedEventId,
        'Submitted Event',
        'A submitted event for testing',
        '2026-07-20T14:00:00Z',
        'submitted',
        false,
        orgId,
        regularUserId,
      ],
    );

    await dataSource.query(
      `INSERT INTO events (id, title, description, "startDate", status, "isVirtual", "orgId", "createdById", "submittedAt", "approvedAt", "moderatedById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        approvedEventId,
        'Approved Event',
        'An approved event for testing',
        '2026-08-10T09:00:00Z',
        'approved',
        false,
        orgId,
        regularUserId,
        moderatorId,
      ],
    );

    await dataSource.query(
      `INSERT INTO events (id, title, description, "startDate", status, "isVirtual", "orgId", "createdById", "submittedAt", "rejectedAt", "rejectionReason", "moderatedById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9, $10, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        rejectedEventId,
        'Rejected Event',
        'A rejected event for testing',
        '2026-09-05T11:00:00Z',
        'rejected',
        false,
        orgId,
        regularUserId,
        'Event contains inappropriate content',
        moderatorId,
      ],
    );

    await dataSource.query(
      `INSERT INTO events (id, title, description, "startDate", status, "isVirtual", "orgId", "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        anotherDraftEventId,
        'Another Draft Event',
        'Another draft event for testing',
        '2026-10-15T10:00:00Z',
        'draft',
        false,
        orgId,
        regularUserId,
      ],
    );
  }

  async function cleanupTestData() {
    try {
      // Delete events first (due to foreign key constraints)
      await dataSource.query(`DELETE FROM events WHERE "orgId" = $1`, [orgId]);
      // Delete users
      await dataSource.query(`DELETE FROM users WHERE "orgId" = $1`, [orgId]);
      // Delete org
      await dataSource.query(`DELETE FROM orgs WHERE id = $1`, [orgId]);
    } catch (error) {
      // Ignore errors during cleanup (data might not exist)
      console.warn('Cleanup warning:', error);
    }
  }

  async function loginAndGetToken(
    email: string,
    password: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, orgId });

    if (response.status !== 200) {
      throw new Error(
        `Login failed for ${email}: ${response.status} - ${JSON.stringify(response.body)}`,
      );
    }

    // Extract token from cookie
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const accessTokenCookie = cookies?.find((c: string) =>
      c.startsWith('access_token='),
    );

    if (accessTokenCookie) {
      const token = accessTokenCookie.split(';')[0].split('=')[1];
      return token;
    }

    throw new Error(`No access token cookie returned for ${email}`);
  }

  // Helper to reset event status for repeated tests
  async function resetEventStatus(eventId: string, status: string) {
    await dataSource.query(
      `UPDATE events SET status = $1, "rejectionReason" = NULL, "submittedAt" = NULL, "approvedAt" = NULL, "rejectedAt" = NULL, "moderatedById" = NULL WHERE id = $2`,
      [status, eventId],
    );
  }

  // ===========================================
  // SUBMIT ENDPOINT TESTS
  // ===========================================
  describe('POST /moderation/events/:id/submit - Submit Event', () => {
    afterEach(async () => {
      // Reset event status after each test
      await resetEventStatus(draftEventId, 'draft');
    });

    it('should allow owner to submit a draft event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${draftEventId}/submit`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(200);

      expect(response.body.status).toBe(EventStatus.SUBMITTED);
      expect(response.body.previousStatus).toBe(EventStatus.DRAFT);
      expect(response.body.action).toBe('submit');
      expect(response.body.message).toContain('submitted');
      expect(response.body.submittedAt).toBeDefined();
    });

    it('should return 403 when non-owner tries to submit', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${draftEventId}/submit`)
        .set('Authorization', `Bearer ${tokenOtherUser}`)
        .expect(403);

      expect(response.body.statusCode).toBe(403);
      expect(response.body.message).toContain('only submit events you created');
    });

    it('should return 409 when event is already submitted', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${submittedEventId}/submit`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(409);

      expect(response.body.statusCode).toBe(409);
      expect(response.body.message).toContain('already submitted');
    });

    it('should return 400 when trying to submit an approved event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${approvedEventId}/submit`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('must be in DRAFT status');
    });

    it('should return 404 for non-existent event', async () => {
      const fakeId = '00000000-0000-4000-a000-000000000000';
      await request(app.getHttpServer())
        .post(`/moderation/events/${fakeId}/submit`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/moderation/events/${draftEventId}/submit`)
        .expect(401);
    });
  });

  // ===========================================
  // APPROVE ENDPOINT TESTS
  // ===========================================
  describe('POST /moderation/events/:id/approve - Approve Event', () => {
    afterEach(async () => {
      // Reset event status after each test
      await resetEventStatus(submittedEventId, 'submitted');
    });

    it('should allow moderator to approve a submitted event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${submittedEventId}/approve`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .expect(200);

      expect(response.body.status).toBe(EventStatus.APPROVED);
      expect(response.body.previousStatus).toBe(EventStatus.SUBMITTED);
      expect(response.body.action).toBe('approve');
      expect(response.body.approvedAt).toBeDefined();
      expect(response.body.moderatedBy).toBeDefined();
      expect(response.body.moderatedBy.id).toBe(moderatorId);
    });

    it('should allow admin to approve a submitted event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${submittedEventId}/approve`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(200);

      expect(response.body.status).toBe(EventStatus.APPROVED);
      expect(response.body.moderatedBy.id).toBe(adminId);
    });

    it('should return 403 when regular user tries to approve', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${submittedEventId}/approve`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(403);

      expect(response.body.statusCode).toBe(403);
    });

    it('should return 400 when trying to approve a draft event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${draftEventId}/approve`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain(
        'must be submitted for review first',
      );
    });

    it('should return 409 when event is already approved', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${approvedEventId}/approve`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .expect(409);

      expect(response.body.statusCode).toBe(409);
      expect(response.body.message).toContain('already approved');
    });

    it('should return 400 when trying to approve a rejected event directly', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${rejectedEventId}/approve`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });

  // ===========================================
  // REJECT ENDPOINT TESTS
  // ===========================================
  describe('POST /moderation/events/:id/reject - Reject Event', () => {
    afterEach(async () => {
      // Reset event status after each test
      await resetEventStatus(submittedEventId, 'submitted');
    });

    it('should allow moderator to reject a submitted event with reason', async () => {
      const rejectData = {
        reason:
          'Event description does not meet community guidelines. Please add more details about the event.',
      };

      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${submittedEventId}/reject`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .send(rejectData)
        .expect(200);

      expect(response.body.status).toBe(EventStatus.REJECTED);
      expect(response.body.previousStatus).toBe(EventStatus.SUBMITTED);
      expect(response.body.action).toBe('reject');
      expect(response.body.rejectionReason).toBe(rejectData.reason);
      expect(response.body.rejectedAt).toBeDefined();
      expect(response.body.moderatedBy.id).toBe(moderatorId);
    });

    it('should allow admin to reject a submitted event', async () => {
      const rejectData = {
        reason:
          'This event violates our content policy. Please revise and resubmit.',
      };

      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${submittedEventId}/reject`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(rejectData)
        .expect(200);

      expect(response.body.status).toBe(EventStatus.REJECTED);
      expect(response.body.moderatedBy.id).toBe(adminId);
    });

    it('should return 403 when regular user tries to reject', async () => {
      const rejectData = { reason: 'Some reason for rejection' };

      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${submittedEventId}/reject`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .send(rejectData)
        .expect(403);

      expect(response.body.statusCode).toBe(403);
    });

    it('should return 400 when rejection reason is missing', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${submittedEventId}/reject`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .send({})
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      // Message is an array of validation errors
      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('reason')]),
      );
    });

    it('should return 400 when rejection reason is too short', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${submittedEventId}/reject`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .send({ reason: 'Too short' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      // Message is an array of validation errors
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('at least 10 characters'),
        ]),
      );
    });

    it('should return 400 when trying to reject a draft event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${draftEventId}/reject`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .send({
          reason: 'This event needs to be submitted first before rejection.',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain(
        'must be submitted for review first',
      );
    });

    it('should return 409 when event is already rejected', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${rejectedEventId}/reject`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .send({ reason: 'Already rejected but trying again.' })
        .expect(409);

      expect(response.body.statusCode).toBe(409);
      expect(response.body.message).toContain('already rejected');
    });

    it('should return 400 when trying to reject an approved event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${approvedEventId}/reject`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .send({ reason: 'Trying to reject an already approved event.' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('already approved');
    });
  });

  // ===========================================
  // REVERT TO DRAFT TESTS
  // ===========================================
  describe('POST /moderation/events/:id/revert-to-draft - Revert to Draft', () => {
    afterEach(async () => {
      // Reset event status after each test
      await resetEventStatus(rejectedEventId, 'rejected');
    });

    it('should allow owner to revert a rejected event to draft', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${rejectedEventId}/revert-to-draft`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(200);

      expect(response.body.status).toBe(EventStatus.DRAFT);
      expect(response.body.previousStatus).toBe(EventStatus.REJECTED);
      expect(response.body.action).toBe('revert-to-draft');
    });

    it('should return 403 when non-owner tries to revert', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${rejectedEventId}/revert-to-draft`)
        .set('Authorization', `Bearer ${tokenOtherUser}`)
        .expect(403);

      expect(response.body.statusCode).toBe(403);
    });

    it('should return 400 when trying to revert a draft event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${draftEventId}/revert-to-draft`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('must be in REJECTED status');
    });

    it('should return 400 when trying to revert an approved event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/moderation/events/${approvedEventId}/revert-to-draft`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });

  // ===========================================
  // PENDING EVENTS LIST TESTS
  // ===========================================
  describe('GET /moderation/events/pending - Get Pending Events', () => {
    it('should allow moderator to view pending events', async () => {
      const response = await request(app.getHttpServer())
        .get('/moderation/events/pending')
        .set('Authorization', `Bearer ${tokenModerator}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.total).toBeDefined();
      expect(response.body.page).toBeDefined();
      expect(response.body.limit).toBeDefined();

      // All returned events should be in SUBMITTED status
      response.body.data.forEach((event: any) => {
        expect(event.status).toBe(EventStatus.SUBMITTED);
      });
    });

    it('should allow admin to view pending events', async () => {
      const response = await request(app.getHttpServer())
        .get('/moderation/events/pending')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });

    it('should return 403 when regular user tries to view pending events', async () => {
      const response = await request(app.getHttpServer())
        .get('/moderation/events/pending')
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(403);

      expect(response.body.statusCode).toBe(403);
    });

    it('should support pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/moderation/events/pending?page=1&limit=5')
        .set('Authorization', `Bearer ${tokenModerator}`)
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });
  });

  // ===========================================
  // STATUS ENDPOINT TESTS
  // ===========================================
  describe('GET /moderation/events/:id/status - Get Event Status', () => {
    it('should return moderation status for an event', async () => {
      const response = await request(app.getHttpServer())
        .get(`/moderation/events/${submittedEventId}/status`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(200);

      expect(response.body.id).toBe(submittedEventId);
      expect(response.body.status).toBe(EventStatus.SUBMITTED);
      expect(response.body.title).toBeDefined();
    });

    it('should include rejection info for rejected events', async () => {
      const response = await request(app.getHttpServer())
        .get(`/moderation/events/${rejectedEventId}/status`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(200);

      expect(response.body.status).toBe(EventStatus.REJECTED);
      expect(response.body.rejectionReason).toBeDefined();
      expect(response.body.rejectedAt).toBeDefined();
    });

    it('should return 404 for non-existent event', async () => {
      const fakeId = '00000000-0000-4000-a000-000000000000';
      await request(app.getHttpServer())
        .get(`/moderation/events/${fakeId}/status`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(404);
    });
  });

  // ===========================================
  // FULL WORKFLOW TEST
  // ===========================================
  describe('Complete Moderation Workflow', () => {
    it('should complete full submit → approve workflow', async () => {
      // Reset the event first
      await resetEventStatus(anotherDraftEventId, 'draft');

      // Step 1: Owner submits the event
      const submitResponse = await request(app.getHttpServer())
        .post(`/moderation/events/${anotherDraftEventId}/submit`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(200);

      expect(submitResponse.body.status).toBe(EventStatus.SUBMITTED);

      // Step 2: Moderator approves the event
      const approveResponse = await request(app.getHttpServer())
        .post(`/moderation/events/${anotherDraftEventId}/approve`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .expect(200);

      expect(approveResponse.body.status).toBe(EventStatus.APPROVED);
      expect(approveResponse.body.previousStatus).toBe(EventStatus.SUBMITTED);
    });

    it('should complete full submit → reject → revert → resubmit → approve workflow', async () => {
      // Reset the event first
      await resetEventStatus(anotherDraftEventId, 'draft');

      // Step 1: Owner submits the event
      await request(app.getHttpServer())
        .post(`/moderation/events/${anotherDraftEventId}/submit`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(200);

      // Step 2: Moderator rejects with feedback
      const rejectResponse = await request(app.getHttpServer())
        .post(`/moderation/events/${anotherDraftEventId}/reject`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .send({
          reason:
            'Please add more details about the event location and agenda.',
        })
        .expect(200);

      expect(rejectResponse.body.status).toBe(EventStatus.REJECTED);

      // Step 3: Owner reverts to draft to edit
      const revertResponse = await request(app.getHttpServer())
        .post(`/moderation/events/${anotherDraftEventId}/revert-to-draft`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(200);

      expect(revertResponse.body.status).toBe(EventStatus.DRAFT);

      // Step 4: Owner resubmits after editing
      const resubmitResponse = await request(app.getHttpServer())
        .post(`/moderation/events/${anotherDraftEventId}/submit`)
        .set('Authorization', `Bearer ${tokenRegularUser}`)
        .expect(200);

      expect(resubmitResponse.body.status).toBe(EventStatus.SUBMITTED);

      // Step 5: Moderator approves
      const finalApproveResponse = await request(app.getHttpServer())
        .post(`/moderation/events/${anotherDraftEventId}/approve`)
        .set('Authorization', `Bearer ${tokenModerator}`)
        .expect(200);

      expect(finalApproveResponse.body.status).toBe(EventStatus.APPROVED);
    });
  });
});
