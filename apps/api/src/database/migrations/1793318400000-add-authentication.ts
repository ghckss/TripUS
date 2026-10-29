import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthentication1793318400000 implements MigrationInterface {
  name = 'AddAuthentication1793318400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "social_auth_provider" AS ENUM ('google', 'apple')`);
    await queryRunner.query(`
      CREATE TABLE "auth_identities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "provider" "social_auth_provider" NOT NULL,
        "subject" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_auth_identities" PRIMARY KEY ("id"),
        CONSTRAINT "fk_auth_identities_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_auth_identities_provider_subject" ON "auth_identities" ("provider", "subject")`);
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" char(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "replaced_by_token_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_refresh_tokens_hash" ON "refresh_tokens" ("token_hash")`);
    await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_user_expires" ON "refresh_tokens" ("user_id", "expires_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "auth_identities"`);
    await queryRunner.query(`DROP TYPE "social_auth_provider"`);
  }
}
