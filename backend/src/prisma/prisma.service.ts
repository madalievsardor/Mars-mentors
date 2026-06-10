import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
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
    // Don't crash the whole app if the DB is unreachable — auth/login and the Mars
    // proxy endpoints work without it. Snapshot/notification features that DO need the
    // DB will surface their own errors at call time.
    try {
      await this.client.$connect();
      this.logger.log('Database connected');
    } catch (err) {
      this.logger.warn(
        `Database connection failed (${(err as Error).message}) — continuing without DB`,
      );
    }
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

  get marsAuth() {
    return this.client.marsAuth;
  }

  get groupRosterSnapshot() {
    return this.client.groupRosterSnapshot;
  }

  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T> {
    return this.client.$queryRaw<T>(query, ...values);
  }

  async $transaction<T>(
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(fn);
  }
}
