import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserEntitlements1793577600000 implements MigrationInterface {
  name = 'AddUserEntitlements1793577600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "subscription_tier" AS ENUM ('free', 'plus')`);
    await queryRunner.query(`ALTER TABLE "users" ADD "subscription_tier" "subscription_tier" NOT NULL DEFAULT 'free'`);
    await queryRunner.query(`ALTER TABLE "users" ADD "successful_ai_generations" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "chk_users_ai_generations" CHECK ("successful_ai_generations" >= 0)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "chk_users_ai_generations"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "successful_ai_generations"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "subscription_tier"`);
    await queryRunner.query(`DROP TYPE "subscription_tier"`);
  }
}
