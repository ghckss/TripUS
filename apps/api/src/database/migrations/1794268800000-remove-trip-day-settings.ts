import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTripDaySettings1794268800000 implements MigrationInterface {
  name = 'RemoveTripDaySettings1794268800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "trip_day_settings"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trip_day_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "trip_id" uuid NOT NULL,
        "date" date NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "start_place_id" uuid,
        "end_place_id" uuid,
        CONSTRAINT "pk_trip_day_settings" PRIMARY KEY ("id"),
        CONSTRAINT "uq_trip_day_settings_trip_date" UNIQUE ("trip_id", "date"),
        CONSTRAINT "chk_trip_day_settings_time" CHECK ("end_time" > "start_time"),
        CONSTRAINT "fk_trip_day_settings_trip" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_trip_day_settings_start_place" FOREIGN KEY ("start_place_id") REFERENCES "saved_places"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_trip_day_settings_end_place" FOREIGN KEY ("end_place_id") REFERENCES "saved_places"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_trip_day_settings_trip" ON "trip_day_settings" ("trip_id")`);
  }
}
