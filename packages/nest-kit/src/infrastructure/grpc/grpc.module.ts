import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GrpcServer } from './grpc-server';

@Module({
  imports: [AuthModule],
  providers: [GrpcServer],
  exports: [GrpcServer],
})
export class GrpcModule {}
