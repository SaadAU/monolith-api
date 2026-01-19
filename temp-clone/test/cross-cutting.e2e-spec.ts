import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { TimingInterceptor } from '../src/common/interceptors';
import {
  ValidationExceptionFilter,
  HttpExceptionFilter,
  AllExceptionsFilter,
} from '../src/common/filters';

describe('Cross-cutting Concerns (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same global configuration as main.ts
    app.useGlobalInterceptors(new TimingInterceptor());
    app.useGlobalFilters(
      new AllExceptionsFilter(),
      new HttpExceptionFilter(),
      new ValidationExceptionFilter(),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('TimingInterceptor', () => {
    it('should add X-Response-Time header to successful responses', async () => {
      const response = await request(app.getHttpServer()).get('/').expect(200);

      expect(response.headers['x-response-time']).toBeDefined();
      expect(response.headers['x-response-time']).toMatch(/^\d+ms$/);
    });

    it('should measure time correctly (positive ms value)', async () => {
      const response = await request(app.getHttpServer()).get('/').expect(200);

      // Time should be a positive number in ms format
      const timeMatch = response.headers['x-response-time'].match(/^(\d+)ms$/);
      expect(timeMatch).not.toBeNull();
      const timeMs = parseInt(timeMatch![1], 10);
      expect(timeMs).toBeGreaterThanOrEqual(0);
    });

    // Note: X-Response-Time is NOT set when guards throw exceptions
    // because interceptors wrap the handler, but guards run before handlers
    // This is expected NestJS behavior
  });

  describe('ValidationExceptionFilter', () => {
    it('should return structured validation errors for invalid signup', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: '123', // too short
          name: '', // empty
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('path');
      expect(response.body).toHaveProperty('timestamp');

      // Check that validation errors are present
      const message = response.body.message;
      expect(Array.isArray(message) || typeof message === 'string').toBe(true);
    });

    it('should return structured validation errors for multiple invalid fields', async () => {
      // Signup endpoint doesn't require auth and has multiple validations
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'not-an-email', // invalid email format
          password: '12', // too short
          name: '', // empty required field
          orgId: 'not-a-uuid', // invalid UUID
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message');
      // Validation should return multiple errors
      expect(
        Array.isArray(response.body.message) ||
          typeof response.body.message === 'string',
      ).toBe(true);
    });
  });

  describe('HttpExceptionFilter', () => {
    it('should return consistent error format for 404', async () => {
      const response = await request(app.getHttpServer())
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('path');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 401 for unauthorized access', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Response Consistency', () => {
    it('should have consistent error structure across different error types', async () => {
      // 400 - Validation error
      const validationError = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'bad' })
        .expect(400);

      // 401 - Auth error
      const authError = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);

      // 404 - Not found
      const notFound = await request(app.getHttpServer())
        .get('/not-found-xyz')
        .expect(404);

      // All should have same base structure
      for (const response of [validationError, authError, notFound]) {
        expect(response.body).toHaveProperty('statusCode');
        expect(response.body).toHaveProperty('path');
        expect(response.body).toHaveProperty('timestamp');
        expect(typeof response.body.timestamp).toBe('string');
        // Verify timestamp is valid ISO date
        expect(new Date(response.body.timestamp).toISOString()).toBe(
          response.body.timestamp,
        );
      }
    });
  });
});
