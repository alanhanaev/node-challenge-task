import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceUpdateState } from '../tokens/entities/price-update-state.entity';
import { Token } from '../tokens/entities/token.entity';

interface PriceUpdateHealthCheck {
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  details: {
    lastUpdate?: Date;
    totalTokens: number;
    processedTokens: number;
    processingProgress: number;
    isStuck: boolean;
  };
  timestamp: string;
}

@Injectable()
export class PriceUpdateHealthService {
  private readonly logger = new Logger(PriceUpdateHealthService.name);

  constructor(
    @InjectRepository(PriceUpdateState)
    private readonly stateRepository: Repository<PriceUpdateState>,
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
  ) {}

  /**
   * Price update process health check
   */
  async checkPriceUpdateHealth(): Promise<PriceUpdateHealthCheck> {
    try {
      // Get current state
      const state = await this.stateRepository.findOne({ where: { id: 1 } });
      const totalTokens = await this.tokenRepository.count();
      
      let processedTokens = 0;
      let processingProgress = 0;
      let isStuck = false;

      if (state && state.lastProcessedId) {
        // Count processed tokens
        processedTokens = await this.tokenRepository
          .createQueryBuilder('token')
          .where('token.id <= :lastId', { lastId: state.lastProcessedId })
          .getCount();
        
        processingProgress = totalTokens > 0 ? (processedTokens / totalTokens) * 100 : 0;
        
        // Check if process is stuck (last update more than 5 minutes ago)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        isStuck = state.lastUpdated && state.lastUpdated < fiveMinutesAgo;
      }

      // Determine status
      let status: 'healthy' | 'unhealthy' | 'warning' = 'healthy';
      let message = 'Price update process is running normally';

      if (isStuck) {
        status = 'unhealthy';
        message = 'Price update process appears to be stuck';
      } else if (processingProgress > 0 && processingProgress < 100) {
        status = 'warning';
        message = `Price update process is ${processingProgress.toFixed(1)}% complete`;
      } else if (processingProgress === 100) {
        message = 'Price update cycle completed, will restart';
      }

      return {
        status,
        message,
        details: {
          lastUpdate: state?.lastUpdated,
          totalTokens,
          processedTokens,
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
