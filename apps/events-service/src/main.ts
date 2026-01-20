import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { EventsServiceModule } from './events-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(EventsServiceModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.EVENTS_SERVICE_HOST || 'localhost',
      port: parseInt(process.env.EVENTS_SERVICE_PORT || '3001', 10),
    },
  });

  await app.listen();
  console.log('Events Service running on port 3001 (TCP)');
}

bootstrap().catch((error) => {
  console.error('Failed to start Events Service:', error);
  process.exit(1);
});
