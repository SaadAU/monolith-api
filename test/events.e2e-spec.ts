import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { EventStatus } from '../src/modules/events/entities/event.entity';

/**
 * E2E Tests for Events CRUD with Org Scoping and Ownership
 * 
 * Tests cover:
 * - CRUD operations for events
 * - Org scoping: users can only see events in their org
 * - Ownership: only event creators can edit/delete their events
 * - Authentication requirements
 */
describe('Events CRUD (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  // Test org IDs
  const orgAId = 'e2e0a001-1111-4111-a111-111111111111';
  const orgBId = 'e2e0b001-1111-4111-a111-111111111111';

  // User IDs for Org A
  const userA1Id = 'e2ea1001-1111-4111-a111-111111111111';
  const userA2Id = 'e2ea2001-1111-4111-a111-111111111111';

  // User ID for Org B
  const userB1Id = 'e2eb1001-1111-4111-a111-111111111111';

  // Event IDs
  const eventA1Id = 'e2eea001-1111-4111-a111-111111111111';
  const eventA2Id = 'e2eea002-1111-4111-a111-111111111111';
  const eventBId = 'e2eeb001-1111-4111-a111-111111111111';

  // JWT tokens
  let tokenUserA1: string;
  let tokenUserA2: string;
  let tokenUserB1: string;

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

    // Get tokens
    tokenUserA1 = await loginAndGetToken('usera1@eventstest.com', 'UserA1Pass123!', orgAId);
    tokenUserA2 = await loginAndGetToken('usera2@eventstest.com', 'UserA2Pass123!', orgAId);
    tokenUserB1 = await loginAndGetToken('userb1@eventstest.com', 'UserB1Pass123!', orgBId);
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create test organizations
    await dataSource.query(
      `INSERT INTO orgs (id, name, slug, description, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [orgAId, 'Events Test Org A', 'events-test-org-a', 'Org A for events e2e tests']
    );

    await dataSource.query(
      `INSERT INTO orgs (id, name, slug, description, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [orgBId, 'Events Test Org B', 'events-test-org-b', 'Org B for events e2e tests']
    );

    // Hash passwords
    const hashA1 = await argon2.hash('UserA1Pass123!', { type: argon2.argon2id });
    const hashA2 = await argon2.hash('UserA2Pass123!', { type: argon2.argon2id });
    const hashB1 = await argon2.hash('UserB1Pass123!', { type: argon2.argon2id });

    // Create users for Org A
    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userA1Id, 'User A1', 'usera1@eventstest.com', hashA1, 'user', orgAId]
    );

    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userA2Id, 'User A2', 'usera2@eventstest.com', hashA2, 'user', orgAId]
    );

    // Create user for Org B
    await dataSource.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "orgId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userB1Id, 'User B1', 'userb1@eventstest.com', hashB1, 'user', orgBId]
    );

    // Create events
    // Event owned by User A1 in Org A
    await dataSource.query(
      `INSERT INTO events (id, title, description, "startDate", status, "isVirtual", "orgId", "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [eventA1Id, 'Org A Event 1', 'Event created by User A1', '2026-06-15T10:00:00Z', 'draft', false, orgAId, userA1Id]
    );

    // Event owned by User A2 in Org A
    await dataSource.query(
      `INSERT INTO events (id, title, description, "startDate", status, "isVirtual", "orgId", "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [eventA2Id, 'Org A Event 2', 'Event created by User A2', '2026-07-20T14:00:00Z', 'approved', false, orgAId, userA2Id]
    );

    // Event owned by User B1 in Org B
    await dataSource.query(
      `INSERT INTO events (id, title, description, "startDate", status, "isVirtual", "orgId", "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [eventBId, 'Org B Event 1', 'Event created by User B1', '2026-08-10T09:00:00Z', 'draft', false, orgBId, userB1Id]
    );
  }

  async function cleanupTestData() {
    // Delete events first
    await dataSource.query(`DELETE FROM events WHERE "orgId" IN ($1, $2)`, [orgAId, orgBId]);
    // Delete users
    await dataSource.query(`DELETE FROM users WHERE "orgId" IN ($1, $2)`, [orgAId, orgBId]);
    // Delete orgs
    await dataSource.query(`DELETE FROM orgs WHERE id IN ($1, $2)`, [orgAId, orgBId]);
  }

  async function loginAndGetToken(email: string, password: string, orgId: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, orgId })
      .expect(200);

    // Extract token from cookie
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const accessTokenCookie = cookies?.find((c: string) => c.startsWith('access_token='));

    if (accessTokenCookie) {
      return accessTokenCookie.split(';')[0].split('=')[1];
    }

    throw new Error('No access token cookie returned');
  }

  // ===========================================
  // AUTHENTICATION TESTS
  // ===========================================
  describe('Authentication Required', () => {
    it('should return 401 when accessing events without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/events')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return 401 when creating event without token', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .send({ title: 'Test Event', startDate: '2026-05-01T10:00:00Z' })
        .expect(401);
    });
  });

  // ===========================================
  // CREATE EVENT TESTS
  // ===========================================
  describe('POST /events - Create Event', () => {
    it('should create a new event successfully', async () => {
      const eventData = {
        title: 'New Test Event',
        description: 'A test event description',
        location: 'Test Venue',
        startDate: '2026-09-01T10:00:00Z',
        endDate: '2026-09-01T18:00:00Z',
        status: EventStatus.DRAFT,
        maxAttendees: 50,
        isVirtual: false,
      };

      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .send(eventData)
        .expect(201);

      expect(response.body).toMatchObject({
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        status: EventStatus.DRAFT,
        maxAttendees: 50,
        isVirtual: false,
        orgId: orgAId,
        createdById: userA1Id,
      });
      expect(response.body.id).toBeDefined();

      // Cleanup
      await dataSource.query(`DELETE FROM events WHERE id = $1`, [response.body.id]);
    });

    it('should create a virtual event with URL', async () => {
      const eventData = {
        title: 'Virtual Conference',
        startDate: '2026-10-01T10:00:00Z',
        isVirtual: true,
        virtualUrl: 'https://zoom.us/j/123456789',
      };

      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .send(eventData)
        .expect(201);

      expect(response.body.isVirtual).toBe(true);
      expect(response.body.virtualUrl).toBe(eventData.virtualUrl);

      // Cleanup
      await dataSource.query(`DELETE FROM events WHERE id = $1`, [response.body.id]);
    });

    it('should reject event with end date before start date', async () => {
      const eventData = {
        title: 'Invalid Date Event',
        startDate: '2026-09-01T18:00:00Z',
        endDate: '2026-09-01T10:00:00Z', // Before start
      };

      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .send(eventData)
        .expect(400);

      expect(response.body.message).toContain('End date must be after start date');
    });

    it('should reject virtual event without URL', async () => {
      const eventData = {
        title: 'Invalid Virtual Event',
        startDate: '2026-09-01T10:00:00Z',
        isVirtual: true,
        // Missing virtualUrl
      };

      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .send(eventData)
        .expect(400);

      expect(response.body.message).toContain('Virtual events must have a virtual URL');
    });

    it('should reject event without required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .send({}) // Missing title and startDate
        .expect(400);

      expect(response.body.message).toContain('Event title is required');
    });
  });

  // ===========================================
  // READ EVENTS TESTS (ORG SCOPING)
  // ===========================================
  describe('GET /events - List Events (Org Scoped)', () => {
    it('should return only events from user\'s org', async () => {
      // User A1 should only see Org A events
      const response = await request(app.getHttpServer())
        .get('/events')
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      
      // All events should belong to Org A
      response.body.data.forEach((event: any) => {
        expect(event.orgId).toBe(orgAId);
      });

      // Should NOT contain Org B's event
      const eventIds = response.body.data.map((e: any) => e.id);
      expect(eventIds).not.toContain(eventBId);
    });

    it('should return different events for different orgs', async () => {
      // User B1 should only see Org B events
      const response = await request(app.getHttpServer())
        .get('/events')
        .set('Authorization', `Bearer ${tokenUserB1}`)
        .expect(200);

      response.body.data.forEach((event: any) => {
        expect(event.orgId).toBe(orgBId);
      });

      // Should NOT contain Org A's events
      const eventIds = response.body.data.map((e: any) => e.id);
      expect(eventIds).not.toContain(eventA1Id);
      expect(eventIds).not.toContain(eventA2Id);
    });

    it('should filter events by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/events')
        .query({ status: EventStatus.DRAFT })
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .expect(200);

      response.body.data.forEach((event: any) => {
        expect(event.status).toBe(EventStatus.DRAFT);
      });
    });

    it('should support pagination', async () => {
      // Test offset-based pagination
      const response = await request(app.getHttpServer())
        .get('/events')
        .query({ paginationType: 'offset', page: 1, limit: 1 })
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.total).toBeDefined();
      expect(response.body.pagination.totalPages).toBeDefined();
    });
  });

  // ===========================================
  // GET SINGLE EVENT (ORG SCOPING)
  // ===========================================
  describe('GET /events/:id - Get Single Event', () => {
    it('should return event in user\'s org', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${eventA1Id}`)
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .expect(200);

      expect(response.body.id).toBe(eventA1Id);
      expect(response.body.orgId).toBe(orgAId);
    });

    it('should return 404 for event in different org', async () => {
      // User A1 trying to access Org B's event
      const response = await request(app.getHttpServer())
        .get(`/events/${eventBId}`)
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should return 404 for non-existent event', async () => {
      await request(app.getHttpServer())
        .get('/events/00000000-0000-4000-a000-000000000000')
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .expect(404);
    });
  });

  // ===========================================
  // GET MY EVENTS
  // ===========================================
  describe('GET /events/my-events - Get User\'s Events', () => {
    it('should return only events created by the current user', async () => {
      const response = await request(app.getHttpServer())
        .get('/events/my-events')
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .expect(200);

      response.body.data.forEach((event: any) => {
        expect(event.createdById).toBe(userA1Id);
      });
    });
  });

  // ===========================================
  // UPDATE EVENT (OWNERSHIP)
  // ===========================================
  describe('PATCH /events/:id - Update Event (Ownership)', () => {
    it('should allow owner to update their event', async () => {
      const updateData = {
        title: 'Updated Event Title',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/events/${eventA1Id}`)
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe(updateData.title);
      expect(response.body.description).toBe(updateData.description);

      // Restore original data
      await dataSource.query(
        `UPDATE events SET title = $1, description = $2 WHERE id = $3`,
        ['Org A Event 1', 'Event created by User A1', eventA1Id]
      );
    });

    it('should return 403 when non-owner tries to update', async () => {
      // User A2 trying to update User A1's event
      const response = await request(app.getHttpServer())
        .patch(`/events/${eventA1Id}`)
        .set('Authorization', `Bearer ${tokenUserA2}`)
        .send({ title: 'Hacked Title' })
        .expect(403);

      expect(response.body.message).toContain('only edit events you created');
    });

    it('should return 404 when updating event in different org', async () => {
      // User A1 trying to update Org B's event
      await request(app.getHttpServer())
        .patch(`/events/${eventBId}`)
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .send({ title: 'Hacked Title' })
        .expect(404);
    });
  });

  // ===========================================
  // DELETE EVENT (OWNERSHIP)
  // ===========================================
  describe('DELETE /events/:id - Delete Event (Ownership)', () => {
    let tempEventId: string;

    beforeEach(async () => {
      // Create a temporary event for deletion tests
      const result = await dataSource.query(
        `INSERT INTO events (id, title, description, "startDate", status, "isVirtual", "orgId", "createdById", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id`,
        ['Temp Event', 'Temporary event for delete test', '2026-12-01T10:00:00Z', 'draft', false, orgAId, userA1Id]
      );
      tempEventId = result[0].id;
    });

    afterEach(async () => {
      // Cleanup if event still exists
      await dataSource.query(`DELETE FROM events WHERE id = $1`, [tempEventId]);
    });

    it('should allow owner to delete their event', async () => {
      await request(app.getHttpServer())
        .delete(`/events/${tempEventId}`)
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .expect(204);

      // Verify deletion
      const result = await dataSource.query(`SELECT id FROM events WHERE id = $1`, [tempEventId]);
      expect(result.length).toBe(0);
    });

    it('should return 403 when non-owner tries to delete', async () => {
      // User A2 trying to delete User A1's event
      const response = await request(app.getHttpServer())
        .delete(`/events/${tempEventId}`)
        .set('Authorization', `Bearer ${tokenUserA2}`)
        .expect(403);

      expect(response.body.message).toContain('only delete events you created');
    });

    it('should return 404 when deleting event in different org', async () => {
      // User B1 trying to delete Org A's event
      await request(app.getHttpServer())
        .delete(`/events/${tempEventId}`)
        .set('Authorization', `Bearer ${tokenUserB1}`)
        .expect(404);
    });
  });

  // ===========================================
  // DTO RESPONSE VALIDATION
  // ===========================================
  describe('Response DTO Validation', () => {
    it('should not leak internal fields in response', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${eventA1Id}`)
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .expect(200);

      // Check expected fields are present
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('orgId');
      expect(response.body).toHaveProperty('createdById');
      expect(response.body).toHaveProperty('createdAt');

      // Ensure no internal/sensitive fields are leaked
      // (Entity might have internal fields in the future)
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('__v');
    });

    it('should include creator info when available', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${eventA1Id}`)
        .set('Authorization', `Bearer ${tokenUserA1}`)
        .expect(200);

      // createdBy should only expose safe fields
      if (response.body.createdBy) {
        expect(response.body.createdBy).toHaveProperty('id');
        expect(response.body.createdBy).toHaveProperty('name');
        expect(response.body.createdBy).not.toHaveProperty('passwordHash');
        expect(response.body.createdBy).not.toHaveProperty('email');
      }
    });
  });

  // ===========================================
  // DAY 9: LISTING - FILTERS, SORT, PAGINATION
  // ===========================================
  describe('Day 9: Listing Features', () => {
    describe('Query Parameter Validation', () => {
      it('should reject unknown query parameters', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ unknownParam: 'value' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(400);

        // message can be string or array
        const messages = Array.isArray(response.body.message) 
          ? response.body.message.join(' ') 
          : response.body.message;
        expect(messages).toContain('should not exist');
      });

      it('should reject invalid status values', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ status: 'invalid_status' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject invalid sortBy values', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ sortBy: 'passwordHash' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject invalid sortOrder values', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ sortOrder: 'INVALID' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject search queries exceeding 100 characters', async () => {
        const longSearch = 'a'.repeat(101);
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ search: longSearch })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(400);

        // message can be string or array
        const messages = Array.isArray(response.body.message) 
          ? response.body.message.join(' ') 
          : response.body.message;
        expect(messages).toContain('100 characters');
      });

      it('should reject invalid limit values', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ paginationType: 'offset', limit: 150 })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject invalid page values', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ paginationType: 'offset', page: 0 })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('Cursor-based Pagination', () => {
      it('should return cursor pagination metadata by default', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        expect(response.body.data).toBeDefined();
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination).toHaveProperty('nextCursor');
        expect(response.body.pagination).toHaveProperty('hasNextPage');
        expect(response.body.pagination).toHaveProperty('hasPrevPage');
        expect(response.body.pagination).toHaveProperty('count');
      });

      it('should paginate using cursor', async () => {
        // Get first page with limit 1
        const firstPage = await request(app.getHttpServer())
          .get('/events')
          .query({ limit: 1, sortBy: 'createdAt', sortOrder: 'ASC' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        expect(firstPage.body.data.length).toBeLessThanOrEqual(1);
        expect(firstPage.body.pagination).toBeDefined();
        expect(firstPage.body.pagination.hasNextPage).toBeDefined();
        expect(firstPage.body.pagination.count).toBeDefined();
        
        // If there's a next page, use the cursor
        if (firstPage.body.pagination.hasNextPage && firstPage.body.pagination.nextCursor) {
          const secondPage = await request(app.getHttpServer())
            .get('/events')
            .query({ 
              cursor: firstPage.body.pagination.nextCursor, 
              limit: 1,
              sortBy: 'createdAt',
              sortOrder: 'ASC'
            })
            .set('Authorization', `Bearer ${tokenUserA1}`)
            .expect(200);

          expect(secondPage.body.pagination.hasPrevPage).toBe(true);
          
          // The cursor mechanism is working if we get a response
          // Data comparison depends on actual test data which may vary
          expect(secondPage.body.data).toBeDefined();
        }
      });

      it('should reject invalid cursor format', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ cursor: 'invalid-cursor' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(400);

        expect(response.body.message).toContain('Invalid cursor');
      });
    });

    describe('Offset-based Pagination', () => {
      it('should return offset pagination metadata when requested', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ paginationType: 'offset' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        expect(response.body.data).toBeDefined();
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination).toHaveProperty('total');
        expect(response.body.pagination).toHaveProperty('page');
        expect(response.body.pagination).toHaveProperty('limit');
        expect(response.body.pagination).toHaveProperty('totalPages');
        expect(response.body.pagination).toHaveProperty('hasNextPage');
        expect(response.body.pagination).toHaveProperty('hasPrevPage');
      });

      it('should paginate correctly with offset', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ paginationType: 'offset', page: 1, limit: 1 })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        expect(response.body.data.length).toBeLessThanOrEqual(1);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(1);
      });
    });

    describe('Sorting', () => {
      it('should sort by startDate ascending', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ sortBy: 'startDate', sortOrder: 'ASC' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        const dates = response.body.data.map((e: any) => new Date(e.startDate).getTime());
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
        }
      });

      it('should sort by startDate descending', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ sortBy: 'startDate', sortOrder: 'DESC' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        const dates = response.body.data.map((e: any) => new Date(e.startDate).getTime());
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
        }
      });

      it('should sort by createdAt', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ sortBy: 'createdAt', sortOrder: 'DESC' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        const dates = response.body.data.map((e: any) => new Date(e.createdAt).getTime());
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
        }
      });

      it('should sort by title', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ sortBy: 'title', sortOrder: 'ASC' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        const titles = response.body.data.map((e: any) => e.title);
        for (let i = 1; i < titles.length; i++) {
          expect(titles[i].localeCompare(titles[i - 1])).toBeGreaterThanOrEqual(0);
        }
      });
    });

    describe('Filtering', () => {
      it('should filter by status', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ status: 'draft' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        response.body.data.forEach((event: any) => {
          expect(event.status).toBe('draft');
        });
      });

      it('should filter by search term', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ search: 'Test' })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        // All returned events should contain 'Test' in title (case-insensitive)
        response.body.data.forEach((event: any) => {
          expect(event.title.toLowerCase()).toContain('test');
        });
      });

      it('should filter by isVirtual', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ isVirtual: true })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        response.body.data.forEach((event: any) => {
          expect(event.isVirtual).toBe(true);
        });
      });

      it('should filter by createdById', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ createdById: userA1Id })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        response.body.data.forEach((event: any) => {
          expect(event.createdById).toBe(userA1Id);
        });
      });
    });

    describe('Combined Queries', () => {
      it('should combine multiple filters', async () => {
        const response = await request(app.getHttpServer())
          .get('/events')
          .query({ 
            status: 'draft',
            sortBy: 'startDate',
            sortOrder: 'DESC',
            limit: 5,
          })
          .set('Authorization', `Bearer ${tokenUserA1}`)
          .expect(200);

        expect(response.body.data.length).toBeLessThanOrEqual(5);
        response.body.data.forEach((event: any) => {
          expect(event.status).toBe('draft');
        });
      });
    });
  });
});
