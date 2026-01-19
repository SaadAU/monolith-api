import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import configuration from '../config/configuration';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { MICROSERVICE_TRANSPORT } from '../../libs/shared';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ClientsModule.registerAsync([
      {
        name: MICROSERVICE_TRANSPORT.AUTH_SERVICE,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host:
              configService.get<string>('AUTH_SERVICE_HOST') || 'auth-service',
            port: configService.get<number>('AUTH_SERVICE_PORT') || 3002,
          },
        }),
        inject: [ConfigService],
      },
      {
        name: MICROSERVICE_TRANSPORT.EVENTS_SERVICE,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host:
              configService.get<string>('EVENTS_SERVICE_HOST') ||
              'events-service',
            port: configService.get<number>('EVENTS_SERVICE_PORT') || 3001,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
