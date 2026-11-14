UPDATE "notifications" AS notification
SET "variables" = '{}'
WHERE notification."variables"::text <> '{}'
  AND NOT EXISTS (
    SELECT 1
    FROM "notification_deliveries" AS delivery
    WHERE delivery."notification_id" = notification."id"
      AND delivery."status" IN ('PENDING', 'PROCESSING')
  );
