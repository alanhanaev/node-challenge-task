import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Chain } from './chain.entity';
import { Logo } from './logo.entity';

@Entity('tokens')
export class Token {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bytea' })
  address: Buffer;

  @Column({ length: 20, nullable: true })
  symbol: string;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({ type: 'smallint', default: 0 })
  decimals: number;

  @Column({ name: 'is_native', default: false })
  isNative: boolean;

  @Column({ name: 'is_protected', default: false })
  isProtected: boolean;

  @Column({ default: 0 })
  priority: number;

  // Foreign Keys
  @Column({ name: 'chain_id', type: 'uuid' })
  chainId: string;

  @Column({ name: 'logo_id', type: 'uuid', nullable: true })
  logoId: string;

  // Relations
  @ManyToOne(() => Chain, (chain) => chain.tokens, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'chain_id' })
  chain: Chain;

  @ManyToOne(() => Logo, (logo) => logo.tokens, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'logo_id' })
  logo: Logo;

  // Price
  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: '0',
  })
  price: string;

  @Column({
    name: 'last_price_update',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastPriceUpdate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
