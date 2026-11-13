import { Module } from '@nestjs/common';
import { BrandingController } from './controllers/branding.controller';
import { BrandingRepository } from './repositories/branding.repository';
import { BrandingService } from './services/branding.service';

@Module({
  controllers: [BrandingController],
  providers: [BrandingRepository, BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}
