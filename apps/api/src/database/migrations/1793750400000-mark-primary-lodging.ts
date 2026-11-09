import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MarkPrimaryLodging1793750400000 implements MigrationInterface {
  name = 'MarkPrimaryLodging1793750400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "saved_places" ADD "is_primary_lodging" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`
      UPDATE "saved_places"
      SET "is_primary_lodging" = true
      WHERE "id" IN (
        SELECT DISTINCT ON ("trip_id") "id"
        FROM "saved_places"
        WHERE "tag" = 'lodging'
        ORDER BY "trip_id", "created_at" ASC
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_saved_places_trip_primary_lodging" ON "saved_places" ("trip_id") WHERE "is_primary_lodging" = true`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_saved_places_trip_primary_lodging"`);
    await queryRunner.query(`ALTER TABLE "saved_places" DROP COLUMN "is_primary_lodging"`);
  }
}
