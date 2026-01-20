import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '@config/configuration';
import { Event } from '@modules/events/entities/event.entity';
import { User } from '@modules/users/entities/user.entity';
import { Org } from '@modules/orgs/entities/org.entity';
import { EventsService } from './services/events.service';
import { EventsController } from './controllers/events.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host') || 'localhost',
        port: configService.get<number>('database.port') || 5432,
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        entities: [Event, User, Org],
        synchronize: configService.get<string>('environment') === 'development',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Event, User, Org]),
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsServiceModule {}
