CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

CREATE TYPE "MediaClass" AS ENUM ('SYSTEM_ASSET', 'USER_CONTENT');

CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'ACTIVE', 'DELETED');

CREATE TYPE "MediaVisibility" AS ENUM ('PRIVATE', 'INTERNAL', 'PUBLIC');

CREATE TYPE "MediaLifecycle" AS ENUM ('TEMPORARY', 'PERMANENT');

CREATE TYPE "ModerationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'DEAD');

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

CREATE TABLE "media_objects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(128),
    "media_class" "MediaClass" NOT NULL,
    "owner_type" VARCHAR(64),
    "owner_id" VARCHAR(255),
    "bucket" VARCHAR(128) NOT NULL,
    "object_key" VARCHAR(1024) NOT NULL,
    "previous_object_key" VARCHAR(1024),
    "content_type" VARCHAR(128) NOT NULL,
    "declared_size_bytes" BIGINT NOT NULL,
    "actual_size_bytes" BIGINT,
    "original_filename" VARCHAR(255),
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE',
    "lifecycle" "MediaLifecycle" NOT NULL DEFAULT 'PERMANENT',
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "moderated_by" VARCHAR(255),
    "moderated_at" TIMESTAMPTZ,
    "moderation_reason" VARCHAR(500),
    "expires_at" TIMESTAMPTZ,
    "retention_until" TIMESTAMPTZ,
    "promoted_at" TIMESTAMPTZ,
    "promoted_by" VARCHAR(255),
    "created_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "hard_deleted_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_idempotency" (
    "scope" VARCHAR(400) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "media_id" UUID NOT NULL,
    "request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_idempotency_pkey" PRIMARY KEY ("scope","key")
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

CREATE INDEX "audit_logs_tenant_id_occurred_at_idx" ON "audit_logs"("tenant_id", "occurred_at");

CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

CREATE INDEX "audit_logs_actor_subject_occurred_at_idx" ON "audit_logs"("actor_subject", "occurred_at");

CREATE INDEX "media_objects_tenant_id_owner_type_owner_id_idx" ON "media_objects"("tenant_id", "owner_type", "owner_id");

CREATE INDEX "media_objects_status_created_at_idx" ON "media_objects"("status", "created_at");

CREATE INDEX "media_objects_lifecycle_expires_at_idx" ON "media_objects"("lifecycle", "expires_at");

CREATE UNIQUE INDEX "media_objects_bucket_object_key_key" ON "media_objects"("bucket", "object_key");

CREATE INDEX "outbox_events_status_next_attempt_at_idx" ON "outbox_events"("status", "next_attempt_at");

ALTER TABLE "media_idempotency" ADD CONSTRAINT "media_idempotency_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE FUNCTION audit_logs_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_mutation();
