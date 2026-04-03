import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Token } from '../src/tokens/entities/token.entity';
import { Chain } from '../src/tokens/entities/chain.entity';
import { Logo } from '../src/tokens/entities/logo.entity';
import { TokenProcessingState } from '../src/tokens/entities/token-processing-state.entity';
import { TokenPriceUpdateService } from '../src/tokens/services/token-price-update.service';
import { MockPriceService } from '../src/tokens/services/mock-price.service';
import { KafkaProducerService } from '../src/kafka/kafka-producer.service';
import { TokenPriceUpdateMessage } from '../src/kafka/models/token-price-update-message';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('TokenPriceService Integration Tests', () => {
  let postgresContainer: StartedTestContainer;
  let moduleRef: TestingModule;
  let tokenRepository: Repository<Token>;
  let chainRepository: Repository<Chain>;
  let logoRepository: Repository<Logo>;
  let tokenProcessingStateRepository: Repository<TokenProcessingState>;
  let tokenPriceUpdateService: TokenPriceUpdateService;
  let kafkaProducerService: KafkaProducerService;

  const testId = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    jest.setTimeout(120000); // 2 minutes timeout for container startup

    try {
      // Start PostgreSQL container
      postgresContainer = await new GenericContainer('postgres:15-alpine')
        .withName(`postgres-test-${testId}`)
        .withEnvironment({
          POSTGRES_USER: 'testuser',
          POSTGRES_PASSWORD: 'testpassword',
          POSTGRES_DB: 'testdb',
        })
        .withExposedPorts(5432)
        .start();

      const postgresHost = postgresContainer.getHost();
      const mappedPostgresPort = postgresContainer.getMappedPort(5432);

      // Create NestJS test module
      moduleRef = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'postgres',
            host: postgresHost,
            port: mappedPostgresPort,
            username: 'testuser',
            password: 'testpassword',
            database: 'testdb',
            entities: [Token, Chain, Logo, TokenProcessingState],
            synchronize: true,
          }),
          TypeOrmModule.forFeature([Token, Chain, Logo, TokenProcessingState]),
        ],
        providers: [
          TokenPriceUpdateService,
          MockPriceService,
          {
            provide: KafkaProducerService,
            useValue: {
              sendPriceUpdateMessage: jest
                .fn()
                .mockImplementation((message: TokenPriceUpdateMessage) =>
                  Promise.resolve(),
                ),
            },
          },
        ],
      }).compile();

      tokenRepository = moduleRef.get<Repository<Token>>(
        getRepositoryToken(Token),
      );
      chainRepository = moduleRef.get<Repository<Chain>>(
        getRepositoryToken(Chain),
      );
      logoRepository = moduleRef.get<Repository<Logo>>(
        getRepositoryToken(Logo),
      );
      tokenProcessingStateRepository = moduleRef.get<
        Repository<TokenProcessingState>
      >(getRepositoryToken(TokenProcessingState));
      tokenPriceUpdateService = moduleRef.get<TokenPriceUpdateService>(
        TokenPriceUpdateService,
      );
      kafkaProducerService =
        moduleRef.get<KafkaProducerService>(KafkaProducerService);
    } catch (error) {
      console.error('Error during test setup:', error);
      throw error;
    }
  }, 120000);

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }

    if (postgresContainer) {
      await postgresContainer.stop();
    }
  }, 30000);

  it('should update token price and send Kafka message', async () => {
    // Create test chain
    const chain = await chainRepository.save({
      name: 'Test Chain',
      chainId: 'test-1',
      isEnabled: true,
    });

    // Create test logo
    const logo = await logoRepository.save({
      bigPath: '/test_big.png',
      smallPath: '/test_small.png',
      thumbPath: '/test_thumb.png',
    });

    // Create test token
    const token = await tokenRepository.save({
      address: Buffer.from([0x01, 0x02, 0x03]),
      symbol: 'TEST',
      name: 'Test Token',
      decimals: 18,
      isNative: false,
      isProtected: false,
      priority: 1,
      chainId: chain.id,
      logoId: logo.id,
      price: '100.00000000',
      lastPriceUpdate: new Date(),
    });

    // Create initial token processing state
    await tokenProcessingStateRepository.save({
      id: 1,
      lastProcessedTokenId: null,
      lastConfirmedTokenId: null,
      instanceId: null,
      updatedAt: new Date(),
      heartbeatAt: new Date(),
    });

    // Manually trigger price update (in real app this is done via @Cron)
    await tokenPriceUpdateService.handlePriceUpdateCron();

    // Check if token price was updated in the database
    const updatedToken = await tokenRepository.findOne({
      where: { id: token.id },
    });
    expect(updatedToken).toBeDefined();
    expect(updatedToken.price).not.toEqual('100.00000000');

    // Check that Kafka producer was called
    expect(kafkaProducerService.sendPriceUpdateMessage).toHaveBeenCalled();
  }, 10000);
});
