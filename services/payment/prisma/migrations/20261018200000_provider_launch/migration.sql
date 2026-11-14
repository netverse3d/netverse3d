ALTER TABLE "payment_attempts" ALTER COLUMN "checkout_url" SET DATA TYPE TEXT;

ALTER TABLE "payment_attempts" ADD COLUMN "order_number" BIGSERIAL NOT NULL;

ALTER SEQUENCE "payment_attempts_order_number_seq" RESTART WITH 1000000;

CREATE UNIQUE INDEX "payment_attempts_order_number_key" ON "payment_attempts"("order_number");
