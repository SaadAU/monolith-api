import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { User } from '../entities/user.entity';
import { Org } from '../../orgs/entities/org.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Org)
    private orgsRepository: Repository<Org>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // First, verify that the organization exists
    const org = await this.orgsRepository.findOne({
      where: { id: createUserDto.orgId },
    });

    if (!org) {
      throw new BadRequestException(
        `Organization with ID '${createUserDto.orgId}' does not exist. Please create the organization first or use a valid orgId.`,
      );
    }

    // Check if email already exists in this org
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email, orgId: createUserDto.orgId },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with email '${createUserDto.email}' already exists in this organization`,
      );
    }

    // Hash password (simple hash for now - use bcrypt in production!)
    const passwordHash = this.hashPassword(createUserDto.password);

    const user = this.usersRepository.create({
      ...createUserDto,
      passwordHash,
    });

    const savedUser = await this.usersRepository.save(user);

    // Remove passwordHash from response
    const { passwordHash: _, ...userWithoutPassword } = savedUser;
    return userWithoutPassword as User;
  }

  async findAll(orgId?: string): Promise<User[]> {
    const whereCondition = orgId
      ? { orgId, isActive: true }
      : { isActive: true };

    return await this.usersRepository.find({
      where: whereCondition,
      relations: ['org'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['org'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  async findByEmail(email: string, orgId: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { email, orgId },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // If email is being updated, ensure it is unique within the same organization
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUserWithEmail = await this.usersRepository.findOne({
        where: { email: updateUserDto.email, orgId: user.orgId },
      });

      if (existingUserWithEmail && existingUserWithEmail.id !== user.id) {
        throw new ConflictException(
          `User with email '${updateUserDto.email}' already exists in this organization`,
        );
      }
    }
    Object.assign(user, updateUserDto);
    return await this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = false;
    return await this.usersRepository.save(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.update(id, { lastLoginAt: new Date() });
  }

  // Simple password hashing - replace with bcrypt in production!
  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }
}
