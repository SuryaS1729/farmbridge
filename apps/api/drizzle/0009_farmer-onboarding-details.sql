ALTER TABLE "farmer_profiles" ADD COLUMN "aadhaar_name" text;--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD COLUMN "village" text;--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD COLUMN "mandal" text;--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD COLUMN "farm_size_acres" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD COLUMN "cocoa_tree_count" integer;--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD CONSTRAINT "farmer_profiles_farm_size_positive_check" CHECK ("farmer_profiles"."farm_size_acres" is null or "farmer_profiles"."farm_size_acres" > 0);--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD CONSTRAINT "farmer_profiles_tree_count_positive_check" CHECK ("farmer_profiles"."cocoa_tree_count" is null or "farmer_profiles"."cocoa_tree_count" > 0);