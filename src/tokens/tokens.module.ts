import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Token } from './entities/token.entity';
import { Chain } from './entities/chain.entity';
import { Logo } from './entities/logo.entity';
import { TokenProcessingState } from './entities/token-processing-state.entity';
import { TokenPriceUpdateService } from './services/token-price-update.service';
import { MockPriceService } from './services/mock-price.service';
import { TokenSeeder } from './services/token-seeder.service';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Token, Chain, Logo, TokenProcessingState]),
    KafkaModule,
  ],
  providers: [TokenPriceUpdateService, MockPriceService, TokenSeeder],
  exports: [TokenSeeder],
})
export class TokensModule {}

