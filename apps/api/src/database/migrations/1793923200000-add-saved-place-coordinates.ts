import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavedPlaceCoordinates1793923200000 implements MigrationInterface {
  name = 'AddSavedPlaceCoordinates1793923200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "saved_places" ADD "latitude" double precision`);
    await queryRunner.query(`ALTER TABLE "saved_places" ADD "longitude" double precision`);
    await queryRunner.query(`ALTER TABLE "saved_places" ADD CONSTRAINT "chk_saved_places_coordinates_pair" CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL))`);
    await queryRunner.query(`ALTER TABLE "saved_places" ADD CONSTRAINT "chk_saved_places_latitude" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)`);
    await queryRunner.query(`ALTER TABLE "saved_places" ADD CONSTRAINT "chk_saved_places_longitude" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "saved_places" DROP CONSTRAINT "chk_saved_places_longitude"`);
    await queryRunner.query(`ALTER TABLE "saved_places" DROP CONSTRAINT "chk_saved_places_latitude"`);
    await queryRunner.query(`ALTER TABLE "saved_places" DROP CONSTRAINT "chk_saved_places_coordinates_pair"`);
    await queryRunner.query(`ALTER TABLE "saved_places" DROP COLUMN "longitude"`);
    await queryRunner.query(`ALTER TABLE "saved_places" DROP COLUMN "latitude"`);
  }
}
