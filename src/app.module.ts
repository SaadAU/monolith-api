import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';  // ADD THIS
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { StudentsModule } from './modules/students/students.module';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    
    // Database connection - ADD THIS
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'eventboard',
      entities: [__dirname + '/**/*.entity{.ts,.js}'], // Finds all entity files
      synchronize: process.env.NODE_ENV !== 'production', // Auto-create tables (DEV ONLY!)
    }),
    
    // Feature modules
    StudentsModule,  // Your students module
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}