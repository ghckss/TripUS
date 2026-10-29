import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhotos1793404800000 implements MigrationInterface {
  name = 'AddPhotos1793404800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "photo_status" AS ENUM ('pending', 'ready', 'failed')`);
    await queryRunner.query(`
      CREATE TABLE "photos" (
        "id" uuid NOT NULL,
        "trip_id" uuid NOT NULL,
        "itinerary_item_id" uuid,
        "original_key" varchar(500) NOT NULL,
        "optimized_key" varchar(500),
        "thumbnail_key" varchar(500),
        "mime_type" varchar(100) NOT NULL,
        "byte_size" bigint NOT NULL,
        "original_filename" varchar(255) NOT NULL,
        "status" "photo_status" NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_photos" PRIMARY KEY ("id"),
        CONSTRAINT "fk_photos_trip" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_photos_itinerary_item" FOREIGN KEY ("itinerary_item_id") REFERENCES "itinerary_items"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_photos_trip_created" ON "photos" ("trip_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "idx_photos_itinerary_item" ON "photos" ("itinerary_item_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "photos"`);
    await queryRunner.query(`DROP TYPE "photo_status"`);
  }
}
