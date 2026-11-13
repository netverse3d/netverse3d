import { Module } from '@nestjs/common';
import { TemplatesController } from './controllers/templates.controller';
import { TemplatesRepository } from './repositories/templates.repository';
import { TemplatesService } from './services/templates.service';

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesRepository, TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
