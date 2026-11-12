import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtVerifier } from './jwt-verifier.service';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [JwtVerifier, JwtAuthGuard, RolesGuard],
  exports: [JwtVerifier, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
