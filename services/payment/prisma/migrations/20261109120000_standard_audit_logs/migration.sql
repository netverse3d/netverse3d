CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

ALTER TABLE "audit_logs" RENAME TO "audit_logs_legacy";
ALTER TABLE "audit_logs_legacy" RENAME CONSTRAINT "audit_logs_pkey" TO "audit_logs_legacy_pkey";

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

INSERT INTO "audit_logs" ("occurred_at", "tenant_id", "actor_subject", "action", "resource_type", "resource_id", "outcome", "metadata")
SELECT
    "created_at" AT TIME ZONE 'UTC',
    "tenant_id"::text,
    "actor_ref",
    "action",
    "entity_type",
    "entity_ref",
    'SUCCESS'::"AuditOutcome",
    CASE
        WHEN jsonb_typeof("payload_json") = 'object' THEN "payload_json"
        WHEN "payload_json" IS NULL OR jsonb_typeof("payload_json") = 'null' THEN '{}'::jsonb
        ELSE jsonb_build_object('payload', "payload_json")
    END || jsonb_build_object('actorType', "actor_type", 'legacyId', "id"::text)
FROM "audit_logs_legacy";

DROP TABLE "audit_logs_legacy";

CREATE INDEX "audit_logs_tenant_id_occurred_at_idx" ON "audit_logs"("tenant_id", "occurred_at");

CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

CREATE INDEX "audit_logs_actor_subject_occurred_at_idx" ON "audit_logs"("actor_subject", "occurred_at");

CREATE FUNCTION audit_logs_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_mutation();
