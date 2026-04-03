import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Token } from './token.entity';

@Entity('logos')
export class Logo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'big_path', length: 500 })
  bigPath: string;

  @Column({ name: 'small_path', length: 500 })
  smallPath: string;

  @Column({ name: 'thumb_path', length: 500 })
  thumbPath: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Token, (token) => token.logo)
  tokens: Token[];
}

