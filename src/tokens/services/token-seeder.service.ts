import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Token } from '../entities/token.entity';
import { Chain } from '../entities/chain.entity';
import { Logo } from '../entities/logo.entity';

@Injectable()
export class TokenSeeder {
  private readonly logger = new Logger(TokenSeeder.name);

  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    @InjectRepository(Chain)
    private readonly chainRepository: Repository<Chain>,
    @InjectRepository(Logo)
    private readonly logoRepository: Repository<Logo>,
  ) {}

  async seed(): Promise<void> {
    // Check if there are already tokens in the database
    const count = await this.tokenRepository.count();
    if (count > 0) {
      this.logger.log('Database already seeded, skipping...');
      return;
    }

    this.logger.log('Seeding initial data...');

    try {
      // Create chains
      const ethereumChain = await this.chainRepository.save({
        name: 'Ethereum',
        chainId: '1',
        isEnabled: true,
      });

      const bitcoinChain = await this.chainRepository.save({
        name: 'Bitcoin',
        chainId: '0',
        isEnabled: true,
      });

      const solanaChain = await this.chainRepository.save({
        name: 'Solana',
        chainId: 'solana',
        isEnabled: true,
      });

      // Create logos
      const ethLogo = await this.logoRepository.save({
        bigPath: '/images/eth_big.png',
        smallPath: '/images/eth_small.png',
        thumbPath: '/images/eth_thumb.png',
      });

      const btcLogo = await this.logoRepository.save({
        bigPath: '/images/btc_big.png',
        smallPath: '/images/btc_small.png',
        thumbPath: '/images/btc_thumb.png',
      });

      const solLogo = await this.logoRepository.save({
        bigPath: '/images/sol_big.png',
        smallPath: '/images/sol_small.png',
        thumbPath: '/images/sol_thumb.png',
      });

      // Create tokens
      const tokens = [
        {
          address: Buffer.from([
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
          ]),
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          isNative: true,
          isProtected: true,
          priority: 1,
          chainId: ethereumChain.id,
          logoId: ethLogo.id,
          price: '3000.00000000',
          lastPriceUpdate: new Date(),
        },
        {
          address: Buffer.from([
            0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19,
          ]),
          symbol: 'BTC',
          name: 'Bitcoin',
          decimals: 8,
          isNative: true,
          isProtected: true,
          priority: 2,
          chainId: bitcoinChain.id,
          logoId: btcLogo.id,
          price: '67000.00000000',
          lastPriceUpdate: new Date(),
        },
        {
          address: Buffer.from([
            0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29,
          ]),
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
          isNative: true,
          isProtected: true,
          priority: 3,
          chainId: solanaChain.id,
          logoId: solLogo.id,
          price: '150.00000000',
          lastPriceUpdate: new Date(),
        },
      ];

      await this.tokenRepository.save(tokens);

      this.logger.log(
        'Successfully seeded database with tokens, chains, and logos',
      );
    } catch (error) {
      this.logger.error(`Error seeding database: ${error.message}`);
      throw error;
    }
  }
}
