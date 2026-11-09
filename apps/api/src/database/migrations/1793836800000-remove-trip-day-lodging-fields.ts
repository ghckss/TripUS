import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTripDayLodgingFields1793836800000 implements MigrationInterface {
  name = 'RemoveTripDayLodgingFields1793836800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trip_day_settings" DROP CONSTRAINT "fk_trip_day_settings_start_place"`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" DROP CONSTRAINT "fk_trip_day_settings_end_place"`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" DROP COLUMN "start_place_id"`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" DROP COLUMN "end_place_id"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trip_day_settings" ADD "start_place_id" uuid`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" ADD "end_place_id" uuid`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" ADD CONSTRAINT "fk_trip_day_settings_start_place" FOREIGN KEY ("start_place_id") REFERENCES "saved_places"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" ADD CONSTRAINT "fk_trip_day_settings_end_place" FOREIGN KEY ("end_place_id") REFERENCES "saved_places"("id") ON DELETE SET NULL`);
  }
}
