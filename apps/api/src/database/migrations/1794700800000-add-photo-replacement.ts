import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhotoReplacement1794700800000 implements MigrationInterface {
  name = 'AddPhotoReplacement1794700800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "photos" ADD "replaces_photo_id" uuid`);
    await queryRunner.query(`ALTER TABLE "photos" ADD CONSTRAINT "fk_photos_replaces_photo" FOREIGN KEY ("replaces_photo_id") REFERENCES "photos"("id") ON DELETE SET NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "photos" DROP CONSTRAINT "fk_photos_replaces_photo"`);
    await queryRunner.query(`ALTER TABLE "photos" DROP COLUMN "replaces_photo_id"`);
  }
}
