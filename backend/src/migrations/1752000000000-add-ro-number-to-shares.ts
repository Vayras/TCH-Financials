import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoNumberToShares1752000000000 implements MigrationInterface {
  name = 'AddRoNumberToShares1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tch_dealcreatorshare ADD COLUMN ro_number varchar(80) NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tch_dealcreatorshare DROP COLUMN ro_number
    `);
  }
}
