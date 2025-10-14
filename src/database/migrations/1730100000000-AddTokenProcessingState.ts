import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenProcessingState1730100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create token_processing_state table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS token_processing_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        last_processed_token_id UUID,
        last_confirmed_token_id UUID,
        instance_id VARCHAR(100),
        updated_at TIMESTAMP DEFAULT NOW(),
        heartbeat_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT single_row_check CHECK (id = 1)
      )
    `);

    // Insert initial row
    await queryRunner.query(`
      INSERT INTO token_processing_state (id, last_processed_token_id, last_confirmed_token_id)
      VALUES (1, NULL, NULL)
      ON CONFLICT (id) DO NOTHING
    `);

    // Create index for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_token_processing_state_heartbeat 
      ON token_processing_state(heartbeat_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS token_processing_state`);
  }
}

