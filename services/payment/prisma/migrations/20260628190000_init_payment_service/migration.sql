-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "api_key_status" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "webhook_endpoint_status" AS ENUM ('active', 'paused', 'disabled');

-- CreateEnum
CREATE TYPE "provider_account_status" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "payment_intent_status" AS ENUM ('pending', 'requires_action', 'processing', 'succeeded', 'failed', 'canceled', 'expired', 'partially_refunded', 'refunded');

-- CreateEnum
CREATE TYPE "payment_attempt_status" AS ENUM ('pending', 'requires_action', 'processing', 'succeeded', 'failed', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "payment_method_type" AS ENUM ('card', 'bank_transfer', 'ewallet', 'qr_code', 'manual');

-- CreateEnum
CREATE TYPE "payment_webhook_status" AS ENUM ('received', 'processed', 'ignored', 'failed');

-- CreateEnum
CREATE TYPE "outbox_delivery_status" AS ENUM ('pending', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "idempotency_status" AS ENUM ('started', 'completed', 'failed');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'active',
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key_prefix" VARCHAR(20) NOT NULL,
    "secret_hash" VARCHAR(255) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "status" "api_key_status" NOT NULL DEFAULT 'active',
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_webhook_endpoints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_iv" VARCHAR(32) NOT NULL,
    "secret_tag" VARCHAR(32) NOT NULL,
    "secret_key_version" INTEGER NOT NULL,
    "status" "webhook_endpoint_status" NOT NULL DEFAULT 'active',
    "subscribed_events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_success_at" TIMESTAMPTZ(6),
    "last_failure_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "provider_code" VARCHAR(40) NOT NULL,
    "account_label" VARCHAR(120) NOT NULL,
    "status" "provider_account_status" NOT NULL DEFAULT 'active',
    "credentials_json" JSONB NOT NULL,
    "config_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_ref" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255),
    "full_name" VARCHAR(160),
    "phone" VARCHAR(40),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID,
    "public_id" VARCHAR(40) NOT NULL,
    "merchant_reference" VARCHAR(120),
    "target_type" VARCHAR(80) NOT NULL,
    "target_ref" VARCHAR(120) NOT NULL,
    "target_snapshot" JSONB NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "currency" VARCHAR(3) NOT NULL,
    "subtotal_minor" BIGINT NOT NULL,
    "discount_minor" BIGINT NOT NULL DEFAULT 0,
    "fee_minor" BIGINT NOT NULL DEFAULT 0,
    "tax_minor" BIGINT NOT NULL DEFAULT 0,
    "total_minor" BIGINT NOT NULL,
    "status" "payment_intent_status" NOT NULL DEFAULT 'pending',
    "provider_lock" VARCHAR(40),
    "metadata_json" JSONB,
    "paid_at" TIMESTAMPTZ(6),
    "canceled_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "expired_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "payment_intent_id" UUID NOT NULL,
    "provider_account_id" UUID,
    "provider_code" VARCHAR(40) NOT NULL,
    "provider_payment_id" VARCHAR(120),
    "provider_order_id" VARCHAR(120),
    "payment_method_type" "payment_method_type" NOT NULL,
    "status" "payment_attempt_status" NOT NULL DEFAULT 'pending',
    "checkout_url" VARCHAR(500),
    "qr_payload" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "failure_code" VARCHAR(80),
    "failure_message" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "payment_intent_id" UUID,
    "payment_attempt_id" UUID,
    "provider_code" VARCHAR(40) NOT NULL,
    "provider_event_id" VARCHAR(120) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "signature" VARCHAR(255),
    "payload_json" JSONB NOT NULL,
    "headers_json" JSONB,
    "status" "payment_webhook_status" NOT NULL DEFAULT 'received',
    "processed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_outbox_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_intent_id" UUID,
    "aggregate_type" VARCHAR(40) NOT NULL,
    "aggregate_id" VARCHAR(120) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payload_json" JSONB NOT NULL,
    "delivery_status" "outbox_delivery_status" NOT NULL DEFAULT 'pending',
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "payment_intent_id" UUID NOT NULL,
    "payment_attempt_id" UUID,
    "customer_id" UUID,
    "public_id" VARCHAR(40) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "reason" VARCHAR(255),
    "status" "refund_status" NOT NULL DEFAULT 'pending',
    "provider_refund_id" VARCHAR(120),
    "request_payload" JSONB,
    "response_payload" JSONB,
    "failed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "scope" VARCHAR(80) NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "resource_type" VARCHAR(40),
    "resource_id" VARCHAR(120),
    "response_json" JSONB,
    "status_code" INTEGER,
    "processing_status" "idempotency_status" NOT NULL DEFAULT 'started',
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID,
    "actor_type" VARCHAR(40) NOT NULL,
    "actor_ref" VARCHAR(120),
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_ref" VARCHAR(120) NOT NULL,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_api_keys_key_prefix_key" ON "tenant_api_keys"("key_prefix");

-- CreateIndex
CREATE INDEX "tenant_api_keys_tenant_id_status_idx" ON "tenant_api_keys"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tenant_webhook_endpoints_tenant_id_status_idx" ON "tenant_webhook_endpoints"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "provider_accounts_tenant_id_provider_code_status_idx" ON "provider_accounts"("tenant_id", "provider_code", "status");

-- CreateIndex
CREATE UNIQUE INDEX "provider_accounts_tenant_id_provider_code_account_label_key" ON "provider_accounts"("tenant_id", "provider_code", "account_label");

-- CreateIndex
CREATE INDEX "customers_tenant_id_email_idx" ON "customers"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_customer_ref_key" ON "customers"("tenant_id", "customer_ref");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_public_id_key" ON "payment_intents"("public_id");

-- CreateIndex
CREATE INDEX "payment_intents_tenant_id_status_created_at_idx" ON "payment_intents"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_intents_tenant_id_target_type_target_ref_idx" ON "payment_intents"("tenant_id", "target_type", "target_ref");

-- CreateIndex
CREATE INDEX "payment_intents_customer_id_created_at_idx" ON "payment_intents"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_tenant_id_merchant_reference_key" ON "payment_intents"("tenant_id", "merchant_reference");

-- CreateIndex
CREATE INDEX "payment_attempts_tenant_id_status_created_at_idx" ON "payment_attempts"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_attempts_payment_intent_id_created_at_idx" ON "payment_attempts"("payment_intent_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_attempts_provider_code_provider_payment_id_idx" ON "payment_attempts"("provider_code", "provider_payment_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_tenant_id_created_at_idx" ON "payment_webhook_events"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_webhook_events_status_created_at_idx" ON "payment_webhook_events"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_code_provider_event_id_key" ON "payment_webhook_events"("provider_code", "provider_event_id");

-- CreateIndex
CREATE INDEX "payment_outbox_events_tenant_id_delivery_status_available_a_idx" ON "payment_outbox_events"("tenant_id", "delivery_status", "available_at");

-- CreateIndex
CREATE INDEX "payment_outbox_events_aggregate_type_aggregate_id_created_a_idx" ON "payment_outbox_events"("aggregate_type", "aggregate_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "refunds_public_id_key" ON "refunds"("public_id");

-- CreateIndex
CREATE INDEX "refunds_tenant_id_status_created_at_idx" ON "refunds"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "refunds_payment_intent_id_created_at_idx" ON "refunds"("payment_intent_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idempotency_records_tenant_id_created_at_idx" ON "idempotency_records"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_tenant_id_scope_idempotency_key_key" ON "idempotency_records"("tenant_id", "scope", "idempotency_key");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_ref_created_at_idx" ON "audit_logs"("entity_type", "entity_ref", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "tenant_api_keys" ADD CONSTRAINT "tenant_api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_webhook_endpoints" ADD CONSTRAINT "tenant_webhook_endpoints_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "provider_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_outbox_events" ADD CONSTRAINT "payment_outbox_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_outbox_events" ADD CONSTRAINT "payment_outbox_events_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
