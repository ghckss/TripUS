import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreDomain1793232000000 implements MigrationInterface {
  name = 'CreateCoreDomain1793232000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "place_tag" AS ENUM ('attraction', 'food', 'cafe', 'shopping', 'lodging', 'transport', 'activity', 'other')`);
    await queryRunner.query(`CREATE TYPE "place_preference" AS ENUM ('must_visit', 'want_to_visit', 'if_time_allows')`);
    await queryRunner.query(`CREATE TYPE "itinerary_source" AS ENUM ('manual', 'ai')`);
    await queryRunner.query(`CREATE TYPE "visit_status" AS ENUM ('rated', 'unrated', 'not_visited')`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "display_name" varchar(80) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "trips" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "owner_id" uuid NOT NULL,
        "title" varchar(120) NOT NULL,
        "destination" varchar(120) NOT NULL,
        "timezone" varchar(64) NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "archived_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_trips" PRIMARY KEY ("id"),
        CONSTRAINT "chk_trips_date_range" CHECK ("end_date" >= "start_date"),
        CONSTRAINT "fk_trips_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_trips_owner_active" ON "trips" ("owner_id", "active")`);
    await queryRunner.query(`
      CREATE TABLE "saved_places" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "trip_id" uuid NOT NULL,
        "google_place_id" varchar(255),
        "name" varchar(180) NOT NULL,
        "address" varchar(300),
        "tag" "place_tag" NOT NULL,
        "preference" "place_preference" NOT NULL,
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_saved_places" PRIMARY KEY ("id"),
        CONSTRAINT "fk_saved_places_trip" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_saved_places_trip" ON "saved_places" ("trip_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_saved_places_trip_google_place" ON "saved_places" ("trip_id", "google_place_id")`);
    await queryRunner.query(`
      CREATE TABLE "itinerary_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "trip_id" uuid NOT NULL,
        "saved_place_id" uuid NOT NULL,
        "date" date,
        "position" integer,
        "locked" boolean NOT NULL DEFAULT false,
        "source" "itinerary_source" NOT NULL,
        "visit_status" "visit_status",
        "rating" smallint,
        "review" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_itinerary_items" PRIMARY KEY ("id"),
        CONSTRAINT "chk_itinerary_item_position" CHECK ("position" >= 0),
        CONSTRAINT "chk_itinerary_item_placement" CHECK (("date" IS NULL AND "position" IS NULL) OR ("date" IS NOT NULL AND "position" IS NOT NULL)),
        CONSTRAINT "chk_itinerary_item_visit_result" CHECK (("visit_status" = 'rated' AND "rating" BETWEEN 1 AND 5) OR ("visit_status" IN ('unrated', 'not_visited') AND "rating" IS NULL) OR ("visit_status" IS NULL AND "rating" IS NULL)),
        CONSTRAINT "fk_itinerary_items_trip" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_itinerary_items_saved_place" FOREIGN KEY ("saved_place_id") REFERENCES "saved_places"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_itinerary_items_trip_date_position" ON "itinerary_items" ("trip_id", "date", "position")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "itinerary_items"`);
    await queryRunner.query(`DROP TABLE "saved_places"`);
    await queryRunner.query(`DROP TABLE "trips"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "visit_status"`);
    await queryRunner.query(`DROP TYPE "itinerary_source"`);
    await queryRunner.query(`DROP TYPE "place_preference"`);
    await queryRunner.query(`DROP TYPE "place_tag"`);
  }
}
