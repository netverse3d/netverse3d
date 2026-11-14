CREATE TYPE "TemplateCategory" AS ENUM ('TRANSACTIONAL', 'OPTIONAL');

ALTER TABLE "notification_templates" ADD COLUMN "category" "TemplateCategory" NOT NULL DEFAULT 'OPTIONAL';

ALTER TABLE "notifications" ADD COLUMN "expires_at" TIMESTAMPTZ;
