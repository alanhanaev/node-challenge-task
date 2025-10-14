import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('price_update_state')
export class PriceUpdateState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'last_processed_id', type: 'uuid', nullable: true })
  lastProcessedId: string;

  @Column({ name: 'last_updated', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastUpdated: Date;
}
