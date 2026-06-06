import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient;
  private readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    const connectionString = this.config.get<string>(
      'DATABASE_URL',
      'postgresql://postgres:postgres@localhost:5432/mars_dashboard',
    );
    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool);
    this.client = new PrismaClient({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
    await this.pool.end();
  }

  get mentorSnapshot() {
    return this.client.mentorSnapshot;
  }

  get notificationSetting() {
    return this.client.notificationSetting;
  }

  get alert() {
    return this.client.alert;
  }

  async $transaction<T>(
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(fn);
  }
}
