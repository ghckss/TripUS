import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiPlanGenerationJobs1794528000000 implements MigrationInterface {
  name = 'AddAiPlanGenerationJobs1794528000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_plan_generations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "trip_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "request" jsonb NOT NULL,
        "target_date" date,
        "status" varchar(24) NOT NULL,
        "failure_reason" varchar(120),
        "started_at" timestamptz,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_ai_plan_generations" PRIMARY KEY ("id"),
        CONSTRAINT "fk_ai_plan_generations_trip" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_ai_plan_generations_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_ai_plan_generations_trip_created" ON "ai_plan_generations" ("trip_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "idx_ai_plan_generations_owner_created" ON "ai_plan_generations" ("owner_id", "created_at")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_ai_plan_generations_active_trip" ON "ai_plan_generations" ("trip_id") WHERE "status" IN ('queued', 'running')`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_plan_generations"`);
  }
}
