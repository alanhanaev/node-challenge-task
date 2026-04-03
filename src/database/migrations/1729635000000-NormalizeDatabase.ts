import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeDatabase1729635000000 implements MigrationInterface {
  name = 'NormalizeDatabase1729635000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create chains table
    await queryRunner.query(`
      CREATE TABLE "chains" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "chain_id" character varying(50) NOT NULL,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UQ_chains_chain_id" UNIQUE ("chain_id"),
        CONSTRAINT "PK_chains" PRIMARY KEY ("id")
      )
    `);

    // Create logos table
    await queryRunner.query(`
      CREATE TABLE "logos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "big_path" character varying(500) NOT NULL,
        "small_path" character varying(500) NOT NULL,
        "thumb_path" character varying(500) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_logos" PRIMARY KEY ("id")
      )
    `);

    // Drop old tokens table
    await queryRunner.query(`DROP TABLE IF EXISTS "tokens"`);

    // Create new normalized tokens table
    await queryRunner.query(`
      CREATE TABLE "tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "address" bytea NOT NULL,
        "symbol" character varying(20),
        "name" character varying(100),
        "decimals" smallint NOT NULL DEFAULT '0',
        "is_native" boolean NOT NULL DEFAULT false,
        "is_protected" boolean NOT NULL DEFAULT false,
        "priority" integer NOT NULL DEFAULT '0',
        "chain_id" uuid NOT NULL,
        "logo_id" uuid,
        "price" numeric(20,8) NOT NULL DEFAULT '0',
        "last_price_update" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tokens_chain_address" UNIQUE ("chain_id", "address"),
        CONSTRAINT "FK_tokens_chain" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tokens_logo" FOREIGN KEY ("logo_id") REFERENCES "logos"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_tokens_chain" ON "tokens" ("chain_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tokens_logo" ON "tokens" ("logo_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tokens_symbol" ON "tokens" ("symbol")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tokens_symbol"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tokens_logo"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tokens_chain"`);

    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP CONSTRAINT IF EXISTS "FK_tokens_logo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP CONSTRAINT IF EXISTS "FK_tokens_chain"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "logos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chains"`);

    // Recreate old denormalized tokens table
    await queryRunner.query(`
      CREATE TABLE "tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "address" bytea NOT NULL,
        "symbol" character varying,
        "name" character varying,
        "decimals" smallint NOT NULL DEFAULT '0',
        "isNative" boolean NOT NULL DEFAULT false,
        "chainId" uuid NOT NULL,
        "isProtected" boolean NOT NULL DEFAULT false,
        "lastUpdateAuthor" character varying,
        "priority" integer NOT NULL DEFAULT '0',
        "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "chain_id" uuid NOT NULL,
        "chain_deid" numeric NOT NULL,
        "chain_name" character varying NOT NULL,
        "chain_isenabled" boolean NOT NULL DEFAULT true,
        "logo_id" uuid NOT NULL,
        "logo_tokenid" uuid,
        "logo_bigrelativepath" character varying NOT NULL,
        "logo_smallrelativepath" character varying NOT NULL,
        "logo_thumbrelativepath" character varying NOT NULL,
        "price" numeric(20,8) NOT NULL DEFAULT '0',
        "lastPriceUpdate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_tokens" PRIMARY KEY ("id")
      )
    `);
  }
}

