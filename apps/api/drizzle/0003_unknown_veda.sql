CREATE TYPE "public"."offer_status" AS ENUM('pending', 'invalid_needs_revision', 'accepted', 'rejected', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."price_status" AS ENUM('draft', 'published', 'withdrawn');--> statement-breakpoint
CREATE TABLE "daily_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commodity_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"base_price_per_kg" numeric(12, 2) NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"status" "price_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_prices_commodity_business_date_unique" UNIQUE("commodity_id","business_date"),
	CONSTRAINT "daily_prices_base_price_nonnegative_check" CHECK ("daily_prices"."base_price_per_kg" >= 0),
	CONSTRAINT "daily_prices_published_at_check" CHECK ("daily_prices"."status" <> 'published' OR "daily_prices"."published_at" IS NOT NULL),
	CONSTRAINT "daily_prices_inr_currency_check" CHECK ("daily_prices"."currency" = 'INR')
);
--> statement-breakpoint
CREATE TABLE "offer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"reason" text,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_events_event_type_nonempty_check" CHECK (length(trim("offer_events"."event_type")) > 0),
	CONSTRAINT "offer_events_actor_type_check" CHECK ("offer_events"."actor_type" IN ('farmer', 'admin', 'system'))
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"daily_price_id" uuid NOT NULL,
	"offered_price_per_kg" numeric(12, 2) NOT NULL,
	"quantity_kg" numeric(12, 3) NOT NULL,
	"moisture_percent" numeric NOT NULL,
	"bean_count_per_100g" numeric NOT NULL,
	"ready_on" date NOT NULL,
	"status" "offer_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_price_nonnegative_check" CHECK ("offers"."offered_price_per_kg" >= 0),
	CONSTRAINT "offers_quantity_positive_check" CHECK ("offers"."quantity_kg" > 0),
	CONSTRAINT "offers_moisture_percentage_check" CHECK ("offers"."moisture_percent" >= 0 AND "offers"."moisture_percent" <= 100),
	CONSTRAINT "offers_bean_count_positive_check" CHECK ("offers"."bean_count_per_100g" > 0),
	CONSTRAINT "offers_expiry_after_submission_check" CHECK ("offers"."expires_at" > "offers"."submitted_at")
);
--> statement-breakpoint
CREATE TABLE "price_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_price_id" uuid NOT NULL,
	"old_price_per_kg" numeric(12, 2),
	"new_price_per_kg" numeric(12, 2) NOT NULL,
	"changed_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_revisions_new_price_nonnegative_check" CHECK ("price_revisions"."new_price_per_kg" >= 0)
);
--> statement-breakpoint
ALTER TABLE "daily_prices" ADD CONSTRAINT "daily_prices_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_prices" ADD CONSTRAINT "daily_prices_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_events" ADD CONSTRAINT "offer_events_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_daily_price_id_daily_prices_id_fk" FOREIGN KEY ("daily_price_id") REFERENCES "public"."daily_prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_revisions" ADD CONSTRAINT "price_revisions_daily_price_id_daily_prices_id_fk" FOREIGN KEY ("daily_price_id") REFERENCES "public"."daily_prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_revisions" ADD CONSTRAINT "price_revisions_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_prices_date_status_idx" ON "daily_prices" USING btree ("business_date" DESC NULLS LAST,"status");--> statement-breakpoint
CREATE INDEX "offer_events_history_idx" ON "offer_events" USING btree ("offer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "offers_one_active_per_farmer_idx" ON "offers" USING btree ("farmer_id") WHERE "offers"."status" IN ('pending', 'invalid_needs_revision');--> statement-breakpoint
CREATE INDEX "offers_admin_queue_idx" ON "offers" USING btree ("status","submitted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "offers_farmer_history_idx" ON "offers" USING btree ("farmer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "offers_daily_price_idx" ON "offers" USING btree ("daily_price_id");--> statement-breakpoint
CREATE INDEX "price_revisions_price_time_idx" ON "price_revisions" USING btree ("daily_price_id","created_at" DESC NULLS LAST);--> statement-breakpoint
INSERT INTO "commodities" ("name") VALUES ('Cocoa') ON CONFLICT ("name") DO NOTHING;
