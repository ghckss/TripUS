import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTripRegions1794009600000 implements MigrationInterface {
  name = 'AddTripRegions1794009600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trips" ADD "regions" jsonb NOT NULL DEFAULT '[]'::jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "regions"`);
  }
}
