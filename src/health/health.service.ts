import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { PriceUpdateHealthService } from './price-update-health.service';

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  message?: string;
  responseTime?: number;
  timestamp: string;
}

export interface HealthChecks {
  [key: string]: HealthCheck;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly priceUpdateHealth: PriceUpdateHealthService,
  ) {}

  /**
   * Readiness checks - verify service readiness to accept traffic
   */
  async getReadinessChecks(): Promise<HealthChecks> {
    const checks: HealthChecks = {};

    // Database readiness
    checks.database = await this.checkDatabase();
    
    // Kafka readiness
    checks.kafka = await this.checkKafka();
    
    // Price update process readiness
    checks.priceUpdate = await this.checkPriceUpdateProcess();

    return checks;
  }

  /**
   * Liveness checks - verify that service is alive
   */
  async getLivenessChecks(): Promise<HealthChecks> {
    const checks: HealthChecks = {};

    // Basic service liveness
    checks.service = {
      status: 'healthy',
      message: 'Service is running',
      timestamp: new Date().toISOString(),
    };

    // Memory usage check
    checks.memory = this.checkMemoryUsage();

    return checks;
  }

  /**
   * Database health check
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple query to check connection
      await this.dataSource.query('SELECT 1');
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        message: 'Database connection is active',
        responseTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Database health check failed: ${error.message}`);
      
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Kafka health check
   */
  private async checkKafka(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Attempt to send test message (or just check connection)
      // In real application you can use kafka.admin() for checking
      await this.kafkaProducer.sendPriceUpdateMessage({
        tokenId: '00000000-0000-0000-0000-000000000000', // Valid UUID for health check
        symbol: 'HEALTH',
        oldPrice: '0',
        newPrice: '0',
        timestamp: new Date(),
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        message: 'Kafka connection is active',
        responseTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Kafka health check failed: ${error.message}`);
      
      return {
        status: 'unhealthy',
        message: `Kafka connection failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Memory usage check
   */
  private checkMemoryUsage(): HealthCheck {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    };

    // Consider memory unhealthy if more than 1GB is used
    const isHealthy = memoryUsageMB.heapUsed < 1024;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: isHealthy 
        ? `Memory usage is normal (${memoryUsageMB.heapUsed}MB)`
        : `High memory usage detected (${memoryUsageMB.heapUsed}MB)`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Price update process health check
   */
  private async checkPriceUpdateProcess(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const priceUpdateHealth = await this.priceUpdateHealth.checkPriceUpdateHealth();
      
      return {
        status: priceUpdateHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
        message: priceUpdateHealth.message,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Price update health check failed: ${error.message}`);
      
      return {
        status: 'unhealthy',
        message: `Price update process check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

}
