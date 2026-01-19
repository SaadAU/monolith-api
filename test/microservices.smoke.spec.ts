/**
 * Smoke Tests for Microservices Architecture
 * Tests basic functionality of API Gateway, Auth Service, and Events Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Microservices Smoke Tests (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdEventId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // Give services time to connect
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================
  // AUTH SERVICE SMOKE TESTS
  // ============================================

  describe('Authentication (via Gateway)', () => {
    it('should signup a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          name: 'Test User',
          phone: '+1234567890',
        });

      if (response.status !== 201) {
        console.error('Signup failed:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');

      authToken = response.body.accessToken;
    });

    it('should login with valid credentials', async () => {
      // First signup
      const signupEmail = `login-test-${Date.now()}@example.com`;
      const signupPassword = 'LoginTest123!';

      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: signupEmail,
          password: signupPassword,
          name: 'Login Test User',
        })
        .expect(201);

      // Then login
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: signupEmail,
          password: signupPassword,
        });

      if (response.status !== 200) {
        console.error('Login failed:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(signupEmail);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should get current user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
    });
  });

  // ============================================
  // EVENTS SERVICE SMOKE TESTS
  // ============================================

  describe('Events Management (via Gateway)', () => {
    it('should create an event', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Event',
          description: 'A test event for smoke testing',
          startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          endDate: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
          location: 'Test Location',
          capacity: 100,
          tags: ['smoke-test', 'testing'],
        });

      if (response.status !== 201) {
        console.error(
          'Create event failed:',
          JSON.stringify(response.body, null, 2),
        );
      }
      expect(response.status).toBe(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
      expect(response.body.title).toBe('Test Event');
      expect(response.body).toHaveProperty('status');

      createdEventId = response.body.id;
    });

    it('should list events', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('skip');
      expect(response.body).toHaveProperty('take');
    });

    it('should get a specific event', async () => {
      if (!createdEventId) {
        console.log('Skipping: No event created in previous test');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/api/v1/events/${createdEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(createdEventId);
      expect(response.body).toHaveProperty('title');
    });

    it('should update an event', async () => {
      if (!createdEventId) {
        console.log('Skipping: No event created in previous test');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/api/v1/events/${createdEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Test Event',
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Test Event');
      expect(response.body.description).toBe('Updated description');
    });

    it('should reject unauthorized access to events', async () => {
      await request(app.getHttpServer()).get('/api/v1/events').expect(401);
    });
  });

  // ============================================
  // INTEGRATION SMOKE TESTS
  // ============================================

  describe('Integration Scenarios', () => {
    it('should complete full user flow: signup -> create event -> list events', async () => {
      // 1. Signup
      const signupResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: `flow-test-${Date.now()}@example.com`,
          password: 'FlowTest123!',
          name: 'Flow Test User',
        })
        .expect(201);

      const token = signupResponse.body.accessToken;
      expect(token).toBeDefined();

      // 2. Create Event
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Integration Test Event',
          description: 'Testing end-to-end flow',
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 172800000).toISOString(),
        })
        .expect(201);

      const eventId = createResponse.body.id;
      expect(eventId).toBeDefined();

      // 3. List Events (should contain created event)
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const createdEvent = listResponse.body.items.find(
        (e: any) => e.id === eventId,
      );
      expect(createdEvent).toBeDefined();
      expect(createdEvent.title).toBe('Integration Test Event');
    });
  });

  // ============================================
  // HEALTH CHECKS
  // ============================================

  describe('Service Health', () => {
    it('should have API gateway running', async () => {
      const response = await request(app.getHttpServer()).get('/').expect(200);

      expect(response.body).toBeDefined();
    });
  });
});
