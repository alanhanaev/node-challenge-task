import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('token_processing_state')
export class TokenProcessingState {
  @PrimaryColumn({ default: 1 })
  id: number;

  @Column({ name: 'last_processed_token_id', type: 'uuid', nullable: true })
  lastProcessedTokenId: string | null;

  @Column({ name: 'last_confirmed_token_id', type: 'uuid', nullable: true })
  lastConfirmedTokenId: string | null;

  @Column({ name: 'instance_id', type: 'varchar', length: 100, nullable: true })
  instanceId: string | null;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ name: 'heartbeat_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  heartbeatAt: Date;
}

