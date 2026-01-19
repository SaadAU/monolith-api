import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgsService } from './services/orgs.service';
import { OrgsController } from './controllers/orgs.controller';
import { Org } from './entities/org.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Org])],
  controllers: [OrgsController],
  providers: [OrgsService],
  exports: [OrgsService],
})
export class OrgsModule {}
