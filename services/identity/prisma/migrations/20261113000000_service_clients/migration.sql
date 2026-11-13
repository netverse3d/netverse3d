CREATE TYPE "ServiceClientStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "service_clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(64) NOT NULL,
    "secret_hash" VARCHAR(64) NOT NULL,
    "audiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ServiceClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "secret_rotated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_clients_name_key" ON "service_clients"("name");
