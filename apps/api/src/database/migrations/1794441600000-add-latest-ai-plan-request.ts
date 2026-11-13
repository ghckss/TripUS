import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLatestAiPlanRequest1794441600000 implements MigrationInterface {
  name = 'AddLatestAiPlanRequest1794441600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trips" ADD COLUMN "latest_ai_plan_request" jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "latest_ai_plan_request"`);
  }
}
