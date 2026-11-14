-- AlterTable
ALTER TABLE "provider_accounts" ADD COLUMN     "credentials_ciphertext" TEXT,
ADD COLUMN     "credentials_iv" VARCHAR(32),
ADD COLUMN     "credentials_key_version" INTEGER,
ADD COLUMN     "credentials_tag" VARCHAR(32),
ADD COLUMN     "external_account_ref" VARCHAR(120);

-- CreateIndex
CREATE INDEX "payment_attempts_provider_code_provider_order_id_idx" ON "payment_attempts"("provider_code", "provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_accounts_provider_code_external_account_ref_key" ON "provider_accounts"("provider_code", "external_account_ref");
