import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenProcessingState } from '../tokens/entities/token-processing-state.entity';
import { Token } from '../tokens/entities/token.entity';

interface PriceUpdateHealthCheck {
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  details: {
    lastUpdate?: Date;
    lastHeartbeat?: Date;
    currentInstance?: string;
    totalTokens: number;
    processedTokens: number;
    confirmedTokens: number;
    processingProgress: number;
    isStuck: boolean;
  };
  timestamp: string;
}

@Injectable()
export class PriceUpdateHealthService {
  private readonly logger = new Logger(PriceUpdateHealthService.name);

  constructor(
    @InjectRepository(TokenProcessingState)
    private readonly stateRepository: Repository<TokenProcessingState>,
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
  ) {}

  /**
   * Price update process health check
   */
  async checkPriceUpdateHealth(): Promise<PriceUpdateHealthCheck> {
    try {
      // Get current processing state
      const state = await this.stateRepository.findOne({ where: { id: 1 } });
      const totalTokens = await this.tokenRepository.count();

      let processedTokens = 0;
      let confirmedTokens = 0;
      let processingProgress = 0;
      let isStuck = false;

      if (state) {
        // Count processed tokens (reserved)
        if (state.lastProcessedTokenId) {
          processedTokens = await this.tokenRepository
            .createQueryBuilder('token')
            .where('token.id <= :lastId', {
              lastId: state.lastProcessedTokenId,
            })
            .getCount();
        }

        // Count confirmed tokens (actually processed)
        if (state.lastConfirmedTokenId) {
          confirmedTokens = await this.tokenRepository
            .createQueryBuilder('token')
            .where('token.id <= :lastId', {
              lastId: state.lastConfirmedTokenId,
            })
            .getCount();
        }

        processingProgress =
          totalTokens > 0 ? (confirmedTokens / totalTokens) * 100 : 0;

        // Check if process is stuck (heartbeat older than 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        isStuck =
          state.instanceId !== null &&
          state.heartbeatAt &&
          state.heartbeatAt < twoMinutesAgo;
      }

      // Determine status
      let status: 'healthy' | 'unhealthy' | 'warning' = 'healthy';
      let message = 'Price update process is running normally';

      if (isStuck) {
        status = 'unhealthy';
        message = `Price update process appears to be stuck (instance: ${state?.instanceId})`;
      } else if (state?.instanceId) {
        status = 'warning';
        message = `Instance ${state.instanceId} is currently processing tokens`;
      } else if (processingProgress === 0) {
        message = 'Price update process is ready to start';
      } else if (processingProgress === 100) {
        message = 'Price update cycle completed, will restart on next cron';
      } else {
        message = `Price update process is ${processingProgress.toFixed(
          1,
        )}% complete`;
      }

      return {
        status,
        message,
        details: {
          lastUpdate: state?.updatedAt,
          lastHeartbeat: state?.heartbeatAt,
          currentInstance: state?.instanceId || undefined,
          totalTokens,
          processedTokens,
          confirmedTokens,
          processingProgress: Math.round(processingProgress * 100) / 100,
          isStuck,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Price update health check failed: ${error.message}`);

      return {
        status: 'unhealthy',
        message: `Failed to check price update health: ${error.message}`,
        details: {
          totalTokens: 0,
          processedTokens: 0,
          confirmedTokens: 0,
          processingProgress: 0,
          isStuck: false,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get token statistics
   */
  async getTokenStatistics() {
    try {
      const stats = await this.tokenRepository
        .createQueryBuilder('token')
        .select([
          'COUNT(*) as total',
          'COUNT(CASE WHEN price > 0 THEN 1 END) as with_price',
          'COUNT(CASE WHEN "lastPriceUpdate" > NOW() - INTERVAL \'1 hour\' THEN 1 END) as recently_updated',
        ])
        .getRawOne();

      return {
        total: parseInt(stats.total),
        withPrice: parseInt(stats.with_price),
        recentlyUpdated: parseInt(stats.recently_updated),
        withoutPrice: parseInt(stats.total) - parseInt(stats.with_price),
        stale: parseInt(stats.with_price) - parseInt(stats.recently_updated),
      };
    } catch (error) {
      this.logger.error(`Failed to get token statistics: ${error.message}`);
      return null;
    }
  }
}
