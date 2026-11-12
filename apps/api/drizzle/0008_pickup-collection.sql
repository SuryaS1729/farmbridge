ALTER TABLE "deals" ADD COLUMN "collected_on" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "collected_weight_kg" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "collection_recorded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "collection_recorded_by" text;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_collection_recorded_by_user_id_fk" FOREIGN KEY ("collection_recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_collected_weight_positive_check" CHECK ("deals"."collected_weight_kg" is null or "deals"."collected_weight_kg" > 0);--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_collection_fields_together_check" CHECK (("deals"."collected_on" is null) = ("deals"."collected_weight_kg" is null));