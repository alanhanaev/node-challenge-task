import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TokensModule } from './tokens/tokens.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthModule } from './health/health.module';
import { Token } from './tokens/entities/token.entity';
import { Chain } from './tokens/entities/chain.entity';
import { Logo } from './tokens/entities/logo.entity';
import { TokenProcessingState } from './tokens/entities/token-processing-state.entity';
import { TokenSeeder } from './tokens/services/token-seeder.service';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(), // Enable cron tasks module
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: appConfig.database.host,
      port: appConfig.database.port,
      username: appConfig.database.username,
      password: appConfig.database.password,
      database: appConfig.database.database,
      entities: [Token, Chain, Logo, TokenProcessingState],
      migrations: [__dirname + '/database/migrations/[0-9]*-*.{js,ts}'],
      migrationsRun: true, // Run migrations automatically
      synchronize: false, // Disabled when using migrations
    }),
    TokensModule, // Import tokens module
    KafkaModule, // Import Kafka module
    HealthModule, // Import health module
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private readonly tokenSeeder: TokenSeeder) {}

  async onApplicationBootstrap() {
    try {
      // Seed initial data - CRITICAL: must complete before server starts
      await this.tokenSeeder.seed();
      console.log('Database seeded successfully');
    } catch (error) {
      console.error('Failed to seed database:', error);
      process.exit(1); // Critical error - stop application
    }
  }
}
