CREATE TYPE "public"."deal_status" AS ENUM('open', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"farmer_id" uuid NOT NULL,
	"accepted_by" text NOT NULL,
	"offered_price_per_kg" numeric(12, 2) NOT NULL,
	"quantity_kg" numeric(12, 3) NOT NULL,
	"moisture_percent" numeric NOT NULL,
	"bean_count_per_100g" numeric NOT NULL,
	"ready_on" date NOT NULL,
	"status" "deal_status" DEFAULT 'open' NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_offer_id_unique" UNIQUE("offer_id"),
	CONSTRAINT "deals_price_positive_check" CHECK ("deals"."offered_price_per_kg" > 0),
	CONSTRAINT "deals_quantity_positive_check" CHECK ("deals"."quantity_kg" > 0)
);
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deals_farmer_history_idx" ON "deals" USING btree ("farmer_id","accepted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "deals_status_idx" ON "deals" USING btree ("status","accepted_at" DESC NULLS LAST);