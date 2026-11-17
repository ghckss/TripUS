import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddItineraryActivities1794614400000 implements MigrationInterface {
  name = 'AddItineraryActivities1794614400000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trips" ADD COLUMN "itinerary_activities" jsonb NOT NULL DEFAULT '[]'::jsonb`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "itinerary_activities"`);
  }
}
