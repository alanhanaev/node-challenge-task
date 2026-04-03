import { DataSource } from 'typeorm';
import { Token } from '../tokens/entities/token.entity';
import { Chain } from '../tokens/entities/chain.entity';
import { Logo } from '../tokens/entities/logo.entity';
import { TokenProcessingState } from '../tokens/entities/token-processing-state.entity';
import { NormalizeDatabase1729635000000 } from './migrations/1729635000000-NormalizeDatabase';
import { AddTokenProcessingState1730100000000 } from './migrations/1730100000000-AddTokenProcessingState';
import appConfig from '../config/app.config';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: appConfig.database.host,
  port: appConfig.database.port,
  username: appConfig.database.username,
  password: appConfig.database.password,
  database: appConfig.database.database,
  entities: [Token, Chain, Logo, TokenProcessingState],
  migrations: [
    NormalizeDatabase1729635000000,
    AddTokenProcessingState1730100000000,
  ],
  synchronize: false, // Set to false when using migrations
  logging: true,
});
