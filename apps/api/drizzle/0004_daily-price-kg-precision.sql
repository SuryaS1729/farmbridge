ALTER TABLE "daily_prices" ALTER COLUMN "base_price_per_kg" SET DATA TYPE numeric(12, 4);--> statement-breakpoint
ALTER TABLE "price_revisions" ALTER COLUMN "old_price_per_kg" SET DATA TYPE numeric(12, 4);--> statement-breakpoint
ALTER TABLE "price_revisions" ALTER COLUMN "new_price_per_kg" SET DATA TYPE numeric(12, 4);