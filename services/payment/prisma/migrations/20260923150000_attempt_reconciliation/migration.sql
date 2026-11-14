-- AlterTable
ALTER TABLE "payment_attempts" ADD COLUMN     "last_reconciled_at" TIMESTAMPTZ(6),
ADD COLUMN     "reconcile_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "payment_attempts_status_last_reconciled_at_idx" ON "payment_attempts"("status", "last_reconciled_at");
