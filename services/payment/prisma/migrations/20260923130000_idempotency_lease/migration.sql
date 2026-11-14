-- AlterTable
ALTER TABLE "idempotency_records" ADD COLUMN     "locked_until" TIMESTAMPTZ(6);
