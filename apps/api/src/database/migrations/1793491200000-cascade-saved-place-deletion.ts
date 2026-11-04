import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CascadeSavedPlaceDeletion1793491200000 implements MigrationInterface {
  name = 'CascadeSavedPlaceDeletion1793491200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "itinerary_items" DROP CONSTRAINT "fk_itinerary_items_saved_place"');
    await queryRunner.query('ALTER TABLE "itinerary_items" ADD CONSTRAINT "fk_itinerary_items_saved_place" FOREIGN KEY ("saved_place_id") REFERENCES "saved_places"("id") ON DELETE CASCADE');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "itinerary_items" DROP CONSTRAINT "fk_itinerary_items_saved_place"');
    await queryRunner.query('ALTER TABLE "itinerary_items" ADD CONSTRAINT "fk_itinerary_items_saved_place" FOREIGN KEY ("saved_place_id") REFERENCES "saved_places"("id") ON DELETE RESTRICT');
  }
}
