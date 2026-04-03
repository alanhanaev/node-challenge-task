import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, Timeout } from '@nestjs/schedule';
import { Token } from '../entities/token.entity';
import { TokenProcessingState } from '../entities/token-processing-state.entity';
import { MockPriceService } from './mock-price.service';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';
import { createTokenPriceUpdateMessage } from '../../kafka/models/token-price-update-message';
import appConfig from '../../config/app.config';

@Injectable()
export class TokenPriceUpdateService {
  private readonly logger = new Logger(TokenPriceUpdateService.name);
  private readonly instanceId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    @InjectRepository(TokenProcessingState)
    private readonly processingStateRepository: Repository<TokenProcessingState>,
    private readonly priceService: MockPriceService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {
    // Generate unique instance ID
    this.instanceId = `${process.env.HOSTNAME || 'instance'}-${
      process.pid
    }-${Date.now()}`;
    this.logger.log(`Service initialized with instance ID: ${this.instanceId}`);
  }

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

  /**
   * Main update method - processes ONE batch per cron execution
   */
  private async updatePrices(): Promise<void> {
    try {
      // Get next batch with distributed lock
      const tokens = await this.getNextBatchWithLock();

      if (!tokens || tokens.length === 0) {
        this.logger.debug(
          `[${this.instanceId}] No tokens to process in this cycle`,
        );
        return;
      }

      this.logger.log(
        `[${this.instanceId}] Processing batch with ${tokens.length} tokens`,
      );

      // Start heartbeat for this batch
      this.startHeartbeat();

      try {
        // Process the batch
        await this.updateTokensBatch(tokens);

        // Confirm processing
        const lastToken = tokens[tokens.length - 1];
        await this.confirmBatchProcessing(lastToken.id);

        this.logger.log(
          `[${this.instanceId}] Successfully processed ${tokens.length} tokens`,
        );
      } finally {
        // Stop heartbeat
        this.stopHeartbeat();
      }
    } catch (error) {
      this.logger.error(
        `[${this.instanceId}] Error processing batch: ${error.message}`,
      );
    }
  }

  /**
   * Get next batch of tokens with distributed lock
   */
  private async getNextBatchWithLock(): Promise<Token[] | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // Set lock and statement timeouts
    await queryRunner.query("SET lock_timeout = '30s'");
    await queryRunner.query("SET statement_timeout = '60s'");

    try {
      await queryRunner.startTransaction();

      // Get processing state with exclusive lock (blocks other instances)
      const state = await queryRunner.query(`
        SELECT last_processed_token_id, last_confirmed_token_id
        FROM token_processing_state
        WHERE id = 1
        FOR UPDATE
      `);

      const lastProcessedId = state[0]?.last_processed_token_id;
      const batchSize = appConfig.priceUpdate.batchSize;

      // Get next batch of tokens
      const tokens = await queryRunner.query(
        `
        SELECT * FROM tokens
        WHERE ($1::uuid IS NULL OR id > $1)
        ORDER BY id ASC
        LIMIT $2
        `,
        [lastProcessedId, batchSize],
      );

      if (tokens.length === 0) {
        // No more tokens - reset state
        await queryRunner.query(`
          UPDATE token_processing_state
          SET last_processed_token_id = NULL,
              last_confirmed_token_id = NULL,
              instance_id = NULL,
              updated_at = NOW()
          WHERE id = 1
        `);

        await queryRunner.commitTransaction();
        return null;
      }

      // Update state with new last_processed_token_id (reserve this batch)
      const lastToken = tokens[tokens.length - 1];
      await queryRunner.query(
        `
        UPDATE token_processing_state
        SET last_processed_token_id = $1,
            instance_id = $2,
            updated_at = NOW(),
            heartbeat_at = NOW()
        WHERE id = 1
        `,
        [lastToken.id, this.instanceId],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[${this.instanceId}] Reserved batch: ${tokens.length} tokens (${tokens[0].id} to ${lastToken.id})`,
      );

      return tokens;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error.message?.includes('lock timeout')) {
        this.logger.warn(
          `[${this.instanceId}] Lock timeout - another instance is processing`,
        );
        return null;
      }

      if (error.message?.includes('statement timeout')) {
        this.logger.error(
          `[${this.instanceId}] Statement timeout - query took too long`,
        );
        return null;
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process batch of tokens (update prices and send to Kafka)
   */
  private async updateTokensBatch(tokens: Token[]): Promise<void> {
    try {
      // Get new prices for all tokens in parallel
      const pricePromises = tokens.map((token) =>
        this.priceService.getRandomPriceForToken(token),
      );
      const newPrices = await Promise.all(pricePromises);

      // Find tokens with changed prices
      const tokensToUpdate: Token[] = [];
      const kafkaMessages: any[] = [];
      const priceChanges: Array<{
        token: Token;
        oldPrice: string;
        newPrice: string;
      }> = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const oldPrice = token.price;
        const newPrice = newPrices[i];

        if (oldPrice !== newPrice) {
          priceChanges.push({ token, oldPrice, newPrice });

          // Prepare Kafka message
          const message = createTokenPriceUpdateMessage({
            tokenId: token.id,
            symbol: token.symbol || 'UNKNOWN',
            oldPrice,
            newPrice,
          });
          kafkaMessages.push(message);

          // Update token
          token.price = newPrice;
          token.lastPriceUpdate = new Date();
          tokensToUpdate.push(token);
        }
      }

      if (tokensToUpdate.length === 0) {
        this.logger.log(
          `[${this.instanceId}] No price changes detected in this batch`,
        );
        return;
      }

      // Send all messages to Kafka in parallel
      const kafkaPromises = kafkaMessages.map((message) =>
        this.kafkaProducer.sendPriceUpdateMessage(message),
      );
      await Promise.all(kafkaPromises);

      // Save all changes to database in one query
      await this.tokenRepository.save(tokensToUpdate);

      this.logger.log(
        `[${this.instanceId}] Batch update completed: ${tokensToUpdate.length}/${tokens.length} tokens updated`,
      );
    } catch (error) {
      this.logger.error(
        `[${this.instanceId}] Error updating token batch: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Confirm that batch processing is complete
   */
  private async confirmBatchProcessing(
    lastConfirmedTokenId: string,
  ): Promise<void> {
    try {
      await this.processingStateRepository.update(1, {
        lastConfirmedTokenId,
        updatedAt: new Date(),
      });

      this.logger.log(
        `[${this.instanceId}] Confirmed processing up to token: ${lastConfirmedTokenId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${this.instanceId}] Error confirming batch: ${error.message}`,
      );
    }
  }

  /**
   * Start heartbeat to indicate this instance is alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.processingStateRepository.update(
          { id: 1, instanceId: this.instanceId },
          { heartbeatAt: new Date() },
        );
      } catch (error) {
        this.logger.error(
          `[${this.instanceId}] Heartbeat update failed: ${error.message}`,
        );
      }
    }, 5000); // Update every 5 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Cleanup stuck processing (runs periodically)
   */
  @Cron('0 */2 * * * *') // Every 2 minutes
  async cleanupStuckProcessing(): Promise<void> {
    try {
      const result = await this.dataSource.query(`
        UPDATE token_processing_state
        SET last_processed_token_id = last_confirmed_token_id,
            instance_id = NULL
        WHERE id = 1
          AND heartbeat_at < NOW() - INTERVAL '1 minute'
          AND instance_id IS NOT NULL
        RETURNING instance_id, heartbeat_at
      `);

      if (result.length > 0) {
        this.logger.warn(
          `Cleaned up stuck processing from instance: ${result[0].instance_id} ` +
            `(last heartbeat: ${result[0].heartbeat_at})`,
        );
      }
    } catch (error) {
      this.logger.error(`Error in cleanup task: ${error.message}`);
    }
  }
}
