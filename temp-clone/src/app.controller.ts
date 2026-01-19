import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller()
@ApiExcludeController()
export class AppController {
  @Get()
  getRoot() {
    return {
      message: 'Welcome to EventBoard API',
      docs: '/api',
    };
  }
}
