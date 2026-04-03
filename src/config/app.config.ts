import { config } from 'dotenv';
import * as process from 'process';

config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

interface KafkaConfig {
  clientId: string;
  brokers: string[];
  groupId: string;
}

interface PriceUpdateConfig {
  cronExpression: string;
  batchSize: number;
}

interface AppConfig {
  env: string;
  http: {
    port: number;
  };
  database: DatabaseConfig;
  kafka: KafkaConfig;
  priceUpdate: PriceUpdateConfig;
}

export default {
  env: process.env.NODE_ENV || 'development',
  http: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'tokens',
  },
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'token-price-service',
    brokers: process.env.KAFKA_BROKERS
      ? process.env.KAFKA_BROKERS.split(',')
      : ['localhost:9092'],
    groupId: process.env.KAFKA_GROUP_ID || 'token-price-group',
  },
  priceUpdate: {
    cronExpression: process.env.PRICE_UPDATE_CRON || '*/5 * * * * *', // Every 5 seconds
    batchSize: process.env.PRICE_UPDATE_BATCH_SIZE
      ? parseInt(process.env.PRICE_UPDATE_BATCH_SIZE)
      : 2, // Default batch size
  },
} as AppConfig;
