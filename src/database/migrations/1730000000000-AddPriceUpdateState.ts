import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPriceUpdateState1730000000000 implements MigrationInterface {
  name = 'AddPriceUpdateState1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "price_update_state" (
        "id" SERIAL PRIMARY KEY,
        "last_processed_id" uuid,
        "last_updated" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);


    // Insert initial state (empty)
    await queryRunner.query(`
      INSERT INTO "price_update_state" ("last_processed_id") 
      VALUES (NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "price_update_state"`);
  }
}
