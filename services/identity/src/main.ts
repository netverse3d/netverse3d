import 'reflect-metadata';
import { runService } from '@netverse/nest-kit';
import { AppModule } from './app.module';

void runService(AppModule);
