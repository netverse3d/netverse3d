-- CreateEnum
CREATE TYPE "outbox_delivery_attempt_status" AS ENUM ('pending', 'delivered', 'dead');

-- AlterTable
ALTER TABLE "payment_outbox_events" ADD COLUMN     "fanned_out_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "payment_outbox_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outbox_event_id" BIGINT NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" "outbox_delivery_attempt_status" NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" VARCHAR(80),
    "last_http_status" INTEGER,
    "last_error" TEXT,
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_outbox_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_outbox_deliveries_status_available_at_idx" ON "payment_outbox_deliveries"("status", "available_at");

-- CreateIndex
CREATE INDEX "payment_outbox_deliveries_endpoint_id_status_idx" ON "payment_outbox_deliveries"("endpoint_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_outbox_deliveries_outbox_event_id_endpoint_id_key" ON "payment_outbox_deliveries"("outbox_event_id", "endpoint_id");

-- AddForeignKey
ALTER TABLE "payment_outbox_deliveries" ADD CONSTRAINT "payment_outbox_deliveries_outbox_event_id_fkey" FOREIGN KEY ("outbox_event_id") REFERENCES "payment_outbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_outbox_deliveries" ADD CONSTRAINT "payment_outbox_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "tenant_webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
