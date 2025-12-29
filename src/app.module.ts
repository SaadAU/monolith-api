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
    
    // Database connection - SQLite (local file-based database)
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'eventboard.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production', // Auto-create tables (DEV ONLY!)
    }),
    
    // Feature modules
    StudentsModule,  // Your students module
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}