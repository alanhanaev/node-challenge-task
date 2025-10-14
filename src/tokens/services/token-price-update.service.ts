import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
import { Token } from '../entities/token.entity';
import { PriceUpdateState } from '../entities/price-update-state.entity';
import { MockPriceService } from './mock-price.service';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';
import { createTokenPriceUpdateMessage } from '../../kafka/models/token-price-update-message';
import appConfig from '../../config/app.config';

@Injectable()
export class TokenPriceUpdateService {
  private readonly logger = new Logger(TokenPriceUpdateService.name);
  private isUpdating: boolean = false; // Mutex flag to prevent concurrent execution

  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    @InjectRepository(PriceUpdateState)
    private readonly stateRepository: Repository<PriceUpdateState>,
    private readonly priceService: MockPriceService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  // Run once on application startup
  @Timeout(0)
  async onApplicationBootstrapUpdatePrices() {
    await this.updatePrices();
  }

  // Run every N seconds via cron (configurable)
  @Cron(appConfig.priceUpdate.cronExpression)
  async handlePriceUpdateCron() {
    await this.updatePrices();
  }

  private async updatePrices(): Promise<void> {
    if (this.isUpdating) {
      this.logger.warn(
        'Price update is already in progress, skipping this run...',
      );
      return;
    }
    this.isUpdating = true;

    try {
      // Get current state
      const state = await this.getPriceUpdateState();
      const batchSize = appConfig.priceUpdate.batchSize;

      // Get next batch of tokens
      const tokens = await this.getTokensBatch(
        state.lastProcessedId,
        batchSize,
      );

      if (tokens.length === 0) {
        this.logger.log('No more tokens to process, resetting state...');
        await this.resetPriceUpdateState();
        return;
      }

      this.logger.log(`Processing batch: ${tokens.length} tokens`);

      // Process tokens
      for (const token of tokens) {
        await this.updateTokenPrice(token);
      }

      // Update state
      const lastToken = tokens[tokens.length - 1];
      await this.updatePriceUpdateState(lastToken.id);

      // If processed less than batchSize - reset state
      if (tokens.length < batchSize) {
        this.logger.log('Reached end of tokens, resetting state...');
        await this.resetPriceUpdateState();
      }
    } catch (error) {
      this.logger.error(`Error updating prices: ${error.message}`);
    } finally {
      this.isUpdating = false;
    }
  }

  private async updateTokenPrice(token: Token): Promise<void> {
    try {
      const oldPrice = token.price;
      const newPrice = await this.priceService.getRandomPriceForToken(token);

      if (oldPrice !== newPrice) {
        // Create message for Kafka using Zod helper function
        const message = createTokenPriceUpdateMessage({
          tokenId: token.id,
          symbol: token.symbol || 'UNKNOWN',
          oldPrice,
          newPrice,
          // timestamp will be set to current date by default if not provided
        });
        await this.kafkaProducer.sendPriceUpdateMessage(message);

        // Update token in database
        token.price = newPrice;
        token.lastPriceUpdate = new Date();
        await this.tokenRepository.save(token);
        this.logger.log(
          `Updated price for ${token.symbol}: ${oldPrice} -> ${newPrice}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating price for token ${token.id}: ${error.message}`,
      );
    }
  }

  // State management methods
  private async getPriceUpdateState(): Promise<PriceUpdateState> {
    let state = await this.stateRepository.findOne({ where: { id: 1 } });

    if (!state) {
      // Create the initial state if it doesn't exist
      state = await this.stateRepository.save({
        lastProcessedId: null,
      });
    }

    return state;
  }

  private async getTokensBatch(
    lastProcessedId: string | null,
    batchSize: number,
  ): Promise<Token[]> {
    const query = this.tokenRepository
      .createQueryBuilder('token')
      .orderBy('token.id', 'ASC')
      .take(batchSize);

    if (lastProcessedId) {
      query.where('token.id > :lastId', { lastId: lastProcessedId });
    }

    return await query.getMany();
  }

  private async updatePriceUpdateState(lastProcessedId: string): Promise<void> {
    await this.stateRepository.update(1, {
      lastProcessedId,
      lastUpdated: new Date(),
    });
  }

  private async resetPriceUpdateState(): Promise<void> {
    await this.stateRepository.update(1, {
      lastProcessedId: null,
      lastUpdated: new Date(),
    });
  }
}
