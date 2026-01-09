import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { ModerationController } from './controllers/moderation.controller';
import { ModerationService } from './services/moderation.service';
import { ModerationEventListener } from './listeners';

@Module({
  imports: [TypeOrmModule.forFeature([Event])],
  controllers: [ModerationController],
  providers: [ModerationService, ModerationEventListener],
  exports: [ModerationService],
})
export class ModerationModule {}
