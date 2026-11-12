import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTripBoundaryPoints1794355200000 implements MigrationInterface {
  name = 'AddTripBoundaryPoints1794355200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trips" ADD COLUMN "start_point" jsonb`);
    await queryRunner.query(`ALTER TABLE "trips" ADD COLUMN "end_point" jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "end_point"`);
    await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "start_point"`);
  }
}
