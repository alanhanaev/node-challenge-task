import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthChecks } from './health.service';
import { PriceUpdateHealthService } from './price-update-health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly priceUpdateHealth: PriceUpdateHealthService,
  ) {}

  /**
   * Basic health check endpoint
   * Returns 200 if service is running
   */
  @Get()
  async getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  /**
   * Readiness check endpoint
   * Returns 200 if service is ready to accept traffic
   */
  @Get('ready')
  async getReadiness(): Promise<{ status: string; timestamp: string; checks: HealthChecks }> {
    const checks = await this.healthService.getReadinessChecks();
    
    const isReady = Object.values(checks).every((check: any) => check.status === 'healthy');
    
    return {
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * Liveness check endpoint
   * Returns 200 if service is alive
   */
  @Get('live')
  async getLiveness(): Promise<{ status: string; timestamp: string; checks: HealthChecks }> {
    const checks = await this.healthService.getLivenessChecks();
    
    const isAlive = Object.values(checks).every((check: any) => check.status === 'healthy');
    
    return {
      status: isAlive ? 'alive' : 'not alive',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * Detailed health status with all components
   */
  @Get('detailed')
  async getDetailedHealth(): Promise<{ status: string; timestamp: string; uptime: number; version: string; memory: NodeJS.MemoryUsage; readiness: HealthChecks; liveness: HealthChecks }> {
    const readiness = await this.healthService.getReadinessChecks();
    const liveness = await this.healthService.getLivenessChecks();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      memory: process.memoryUsage(),
      readiness,
      liveness,
    };
  }

  /**
   * Price update process health and statistics
   */
  @Get('price-update')
  async getPriceUpdateHealth() {
    const health = await this.priceUpdateHealth.checkPriceUpdateHealth();
    const statistics = await this.priceUpdateHealth.getTokenStatistics();
    
    return {
      ...health,
      statistics,
    };
  }
}
