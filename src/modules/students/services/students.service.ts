import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { CreateStudentDto } from '../dto/create-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';

@Injectable()  // Makes this injectable (like .NET DI)
export class StudentsService {
  constructor(
    @InjectRepository(Student)  // Inject TypeORM repository
    private studentsRepository: Repository<Student>,
  ) {}

  // CREATE
  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    const student = this.studentsRepository.create(createStudentDto);
    return await this.studentsRepository.save(student);
  }

  // READ ALL
  async findAll(): Promise<Student[]> {
    return await this.studentsRepository.find();
  }

  // READ ONE
  async findOne(id: string): Promise<Student> {
    const student = await this.studentsRepository.findOne({ where: { id } });
    
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    
    return student;
  }

  // UPDATE
  async update(id: string, updateStudentDto: UpdateStudentDto): Promise<Student> {
    const student = await this.findOne(id); // Reuse findOne for existence check
    
    Object.assign(student, updateStudentDto); // Merge changes
    return await this.studentsRepository.save(student);
  }

  // DELETE
  async remove(id: string): Promise<void> {
    const result = await this.studentsRepository.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
  }
}