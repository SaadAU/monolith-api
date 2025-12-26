import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsService } from './services/students.service';
import { StudentsController } from './controller/students.controller';
import { Student } from './entities/student.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Student])],  // Register entity
  controllers: [StudentsController],                // Register controller
  providers: [StudentsService],                     // Register service
  exports: [StudentsService],                       // Export if other modules need it
})
export class StudentsModule {}