import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnrichAiItinerary1794096000000 implements MigrationInterface {
  name = 'EnrichAiItinerary1794096000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "itinerary_items" ADD "scheduled_time" time`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" ADD "duration_minutes" integer`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" ADD "activity_summary" varchar(500)`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" ADD "travel_method" varchar(120)`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" ADD "travel_duration_minutes" integer`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" ADD CONSTRAINT "chk_itinerary_item_duration" CHECK ("duration_minutes" IS NULL OR "duration_minutes" BETWEEN 15 AND 720)`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" ADD CONSTRAINT "chk_itinerary_item_travel_duration" CHECK ("travel_duration_minutes" IS NULL OR "travel_duration_minutes" BETWEEN 0 AND 720)`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" ADD "plan_b_place_name" varchar(180)`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" ADD "plan_b_address" varchar(300)`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" ADD "plan_b_reason" varchar(500)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trip_day_settings" DROP COLUMN "plan_b_reason"`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" DROP COLUMN "plan_b_address"`);
    await queryRunner.query(`ALTER TABLE "trip_day_settings" DROP COLUMN "plan_b_place_name"`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" DROP CONSTRAINT "chk_itinerary_item_travel_duration"`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" DROP CONSTRAINT "chk_itinerary_item_duration"`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" DROP COLUMN "travel_duration_minutes"`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" DROP COLUMN "travel_method"`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" DROP COLUMN "activity_summary"`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" DROP COLUMN "duration_minutes"`);
    await queryRunner.query(`ALTER TABLE "itinerary_items" DROP COLUMN "scheduled_time"`);
  }
}
