import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { IncomingMessage } from 'http';
import configuration from './config/configuration';
import { AppController } from './app.controller';
//import { StudentsModule } from './modules/students/students.module';
// import { HealthModule } from './modules/health/health.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { CorrelationIdMiddleware, REQUEST_ID_HEADER } from './common/middleware';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Pino Logger module
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get<string>('environment') === 'production' ? 'info' : 'debug',
          transport: {
            targets: [
              // Console output (pretty in dev, JSON in prod)
              configService.get<string>('environment') !== 'production'
                ? {
                    target: 'pino-pretty',
                    options: {
                      colorize: true,
                      singleLine: true,
                      translateTime: 'SYS:standard',
                    },
                  }
                : {
                    target: 'pino/file',
                    options: { destination: 1 }, // stdout
                  },
              // File output (JSON)
              {
                target: 'pino/file',
                options: { destination: './logs/app.log', mkdir: true },
              },
            ],
          },
          customProps: (req: IncomingMessage) => ({
            requestId: (req as IncomingMessage & { [REQUEST_ID_HEADER]?: string })[REQUEST_ID_HEADER],
          }),
          autoLogging: false, // We use our own LoggingInterceptor
        },
      }),
      inject: [ConfigService],
    }),

    // Database connection - PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('environment') !== 'production', // Auto-create tables (DEV ONLY!)
      }),
      inject: [ConfigService],
    }),
    
    // Feature modules
    // HealthModule,
    // StudentsModule,
    OrgsModule,
    UsersModule,
    AuthModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}