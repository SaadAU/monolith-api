import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Org } from '../entities/org.entity';
import { CreateOrgDto } from '../dto/create-org.dto';
import { UpdateOrgDto } from '../dto/update-org.dto';

@Injectable()
export class OrgsService {
  constructor(
    @InjectRepository(Org)
    private orgsRepository: Repository<Org>,
  ) {}

  async create(createOrgDto: CreateOrgDto): Promise<Org> {
    // Check if slug already exists
    const existingOrg = await this.orgsRepository.findOne({
      where: { slug: createOrgDto.slug },
    });

    if (existingOrg) {
      throw new ConflictException(
        `Organization with slug '${createOrgDto.slug}' already exists`,
      );
    }

    const org = this.orgsRepository.create(createOrgDto);
    return await this.orgsRepository.save(org);
  }

  async findAll(): Promise<Org[]> {
    return await this.orgsRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Org> {
    const org = await this.orgsRepository.findOne({
      where: { id },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }

    return org;
  }

  async findBySlug(slug: string): Promise<Org> {
    const org = await this.orgsRepository.findOne({
      where: { slug },
    });

    if (!org) {
      throw new NotFoundException(`Organization with slug '${slug}' not found`);
    }

    return org;
  }

  async update(id: string, updateOrgDto: UpdateOrgDto): Promise<Org> {
    const org = await this.findOne(id);

    // If updating slug, check for conflicts
    if (updateOrgDto.slug && updateOrgDto.slug !== org.slug) {
      const existingOrg = await this.orgsRepository.findOne({
        where: { slug: updateOrgDto.slug },
      });

      if (existingOrg) {
        throw new ConflictException(
          `Organization with slug '${updateOrgDto.slug}' already exists`,
        );
      }
    }

    Object.assign(org, updateOrgDto);
    return await this.orgsRepository.save(org);
  }

  async remove(id: string): Promise<void> {
    const result = await this.orgsRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }
  }

  async deactivate(id: string): Promise<Org> {
    const org = await this.orgsRepository.findOne({
      where: { id },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }
    org.isActive = false;
    return await this.orgsRepository.save(org);
  }
}
