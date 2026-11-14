-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "failure_reason" TEXT,
ADD COLUMN     "last_reconciled_at" TIMESTAMPTZ(6),
ADD COLUMN     "reconcile_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "refunds_status_last_reconciled_at_idx" ON "refunds"("status", "last_reconciled_at");
