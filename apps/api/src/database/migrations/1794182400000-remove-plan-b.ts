import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePlanB1794182400000 implements MigrationInterface {
  name = 'RemovePlanB1794182400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "trip_day_settings" DROP COLUMN "plan_b_reason"');
    await queryRunner.query('ALTER TABLE "trip_day_settings" DROP COLUMN "plan_b_address"');
    await queryRunner.query('ALTER TABLE "trip_day_settings" DROP COLUMN "plan_b_place_name"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "trip_day_settings" ADD "plan_b_place_name" varchar(180)');
    await queryRunner.query('ALTER TABLE "trip_day_settings" ADD "plan_b_address" varchar(300)');
    await queryRunner.query('ALTER TABLE "trip_day_settings" ADD "plan_b_reason" varchar(500)');
  }
}
