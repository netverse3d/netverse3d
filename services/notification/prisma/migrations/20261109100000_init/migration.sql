CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'DEAD');

CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL', 'PUSH', 'IN_APP');

CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'DEAD');

CREATE TYPE "NotificationSource" AS ENUM ('API', 'EVENT');

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_id" VARCHAR(128),
    "tenant_id" VARCHAR(128),
    "actor_subject" VARCHAR(255),
    "actor_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "action" VARCHAR(128) NOT NULL,
    "resource_type" VARCHAR(64) NOT NULL,
    "resource_id" VARCHAR(255),
    "outcome" "AuditOutcome" NOT NULL,
    "error_code" VARCHAR(128),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" VARCHAR(128) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "tenant_id" VARCHAR(128),
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(128) NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "subject" VARCHAR(1000) NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "branding_entries" (
    "tenant_id" VARCHAR(128) NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "value" VARCHAR(4000) NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "branding_entries_pkey" PRIMARY KEY ("tenant_id","key")
);

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(128) NOT NULL,
    "source" "NotificationSource" NOT NULL,
    "idempotency_key" VARCHAR(128),
    "request_hash" BYTEA,
    "event_type" VARCHAR(128) NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "recipient_subject" VARCHAR(255),
    "recipient_email" VARCHAR(320),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "tenant_id" VARCHAR(128) NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "destination" VARCHAR(512),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMPTZ,
    "reason" VARCHAR(64),
    "detail" VARCHAR(1000),
    "template_id" UUID,
    "template_version" INTEGER,
    "provider_message_id" VARCHAR(255),
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inbox_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(128) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "delivery_id" UUID NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "title" VARCHAR(1000) NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipient_opt_outs" (
    "tenant_id" VARCHAR(128) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipient_opt_outs_pkey" PRIMARY KEY ("tenant_id","subject","channel","event_type")
);

CREATE TABLE "blocked_addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(128) NOT NULL,
    "address" VARCHAR(512) NOT NULL,
    "reason" VARCHAR(255),
    "created_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_tenant_id_occurred_at_idx" ON "audit_logs"("tenant_id", "occurred_at");

CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

CREATE INDEX "audit_logs_actor_subject_occurred_at_idx" ON "audit_logs"("actor_subject", "occurred_at");

CREATE INDEX "outbox_events_status_next_attempt_at_idx" ON "outbox_events"("status", "next_attempt_at");

CREATE INDEX "notification_templates_tenant_id_created_at_idx" ON "notification_templates"("tenant_id", "created_at");

CREATE UNIQUE INDEX "notification_templates_tenant_id_event_type_channel_locale_key" ON "notification_templates"("tenant_id", "event_type", "channel", "locale");

CREATE INDEX "notifications_tenant_id_created_at_idx" ON "notifications"("tenant_id", "created_at");

CREATE UNIQUE INDEX "notifications_tenant_id_source_idempotency_key_key" ON "notifications"("tenant_id", "source", "idempotency_key");

CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

CREATE INDEX "notification_deliveries_tenant_id_created_at_idx" ON "notification_deliveries"("tenant_id", "created_at");

CREATE INDEX "notification_deliveries_tenant_id_status_created_at_idx" ON "notification_deliveries"("tenant_id", "status", "created_at");

CREATE INDEX "notification_deliveries_tenant_id_event_type_created_at_idx" ON "notification_deliveries"("tenant_id", "event_type", "created_at");

CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");

CREATE UNIQUE INDEX "inbox_items_delivery_id_key" ON "inbox_items"("delivery_id");

CREATE INDEX "inbox_items_tenant_id_subject_created_at_idx" ON "inbox_items"("tenant_id", "subject", "created_at");

CREATE INDEX "inbox_items_tenant_id_subject_read_at_idx" ON "inbox_items"("tenant_id", "subject", "read_at");

CREATE INDEX "blocked_addresses_tenant_id_created_at_idx" ON "blocked_addresses"("tenant_id", "created_at");

CREATE UNIQUE INDEX "blocked_addresses_tenant_id_address_key" ON "blocked_addresses"("tenant_id", "address");

ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE FUNCTION audit_logs_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_mutation();
