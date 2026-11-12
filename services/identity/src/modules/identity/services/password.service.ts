import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AppConfig } from '../../../config/app-config';

const TIMING_DECOY_PASSWORD = 'timing-decoy-password';

@Injectable()
export class PasswordService {
  private decoyHash?: Promise<string>;

  constructor(private readonly config: AppConfig) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.password.bcryptCost);
  }

  matches(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async burnComparisonTime(password: string): Promise<void> {
    this.decoyHash ??= this.hash(TIMING_DECOY_PASSWORD);
    await bcrypt.compare(password, await this.decoyHash);
  }
}
