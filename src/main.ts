import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter, AllExceptionsFilter } from './common/filters';
import { LoggingInterceptor } from './common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Enable cookie-parser for JWT in cookies
  app.use(cookieParser());

  // Use Pino logger
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Global logging interceptor (uses PinoLogger for structured logging)
  const pinoLogger = await app.resolve(PinoLogger);
  app.useGlobalInterceptors(new LoggingInterceptor(pinoLogger));

  // Global exception filters (order matters - AllExceptions should be first)
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error if unknown properties sent
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert query params to proper types
      },
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('EventBoard API')
    .setDescription('The EventBoard monolith API documentation')
    .setVersion('1.0')
    .addTag('students', 'Student management endpoints')
    .addTag('health', 'Health check endpoints')
    .addTag('Authentication', 'User authentication endpoints')
    .addBearerAuth()
    .addCookieAuth('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`🚀 Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  logger.log(`📚 Swagger UI available at: http://localhost:${process.env.PORT ?? 3000}/api`);
}
void bootstrap();
