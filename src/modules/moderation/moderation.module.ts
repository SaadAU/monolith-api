import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { ModerationController } from './controllers/moderation.controller';
import { ModerationService } from './services/moderation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Event])],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
