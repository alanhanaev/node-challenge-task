import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PriceUpdateHealthService } from './price-update-health.service';
import { KafkaModule } from '../kafka/kafka.module';
import { TokenProcessingState } from '../tokens/entities/token-processing-state.entity';
import { Token } from '../tokens/entities/token.entity';

@Module({
  imports: [
    KafkaModule,
    TypeOrmModule.forFeature([TokenProcessingState, Token]),
  ],
  controllers: [HealthController],
  providers: [HealthService, PriceUpdateHealthService],
  exports: [HealthService, PriceUpdateHealthService],
})
export class HealthModule {}
