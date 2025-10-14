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

      // Process tokens in batch
      await this.updateTokensBatch(tokens);

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

  private async updateTokensBatch(tokens: Token[]): Promise<void> {
    try {
      // Получить новые цены для всех токенов параллельно
      const pricePromises = tokens.map(token => 
        this.priceService.getRandomPriceForToken(token)
      );
      const newPrices = await Promise.all(pricePromises);

      // Найти токены с изменившимися ценами
      const tokensToUpdate: Token[] = [];
      const kafkaMessages: any[] = [];
      const priceChanges: Array<{token: Token, oldPrice: string, newPrice: string}> = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const oldPrice = token.price;
        const newPrice = newPrices[i];

        if (oldPrice !== newPrice) {
          // Сохранить информацию об изменении для логирования
          priceChanges.push({ token, oldPrice, newPrice });

          // Подготовить сообщение для Kafka
          const message = createTokenPriceUpdateMessage({
            tokenId: token.id,
            symbol: token.symbol || 'UNKNOWN',
            oldPrice,
            newPrice,
          });
          kafkaMessages.push(message);

          // Обновить токен
          token.price = newPrice;
          token.lastPriceUpdate = new Date();
          tokensToUpdate.push(token);
        }
      }

      if (tokensToUpdate.length === 0) {
        this.logger.log('No price changes detected in this batch');
        return;
      }

      // Отправить все сообщения в Kafka параллельно
      const kafkaPromises = kafkaMessages.map(message => 
        this.kafkaProducer.sendPriceUpdateMessage(message)
      );
      await Promise.all(kafkaPromises);

      // Сохранить все изменения в базе данных одним запросом
      await this.tokenRepository.save(tokensToUpdate);

      this.logger.log(
        `Batch update completed: ${tokensToUpdate.length}/${tokens.length} tokens updated`
      );

      // Логировать детали изменений
      for (const change of priceChanges) {
        this.logger.log(
          `Updated price for ${change.token.symbol}: ${change.oldPrice} -> ${change.newPrice}`
        );
      }

    } catch (error) {
      this.logger.error(`Error updating token batch: ${error.message}`);
      throw error;
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
