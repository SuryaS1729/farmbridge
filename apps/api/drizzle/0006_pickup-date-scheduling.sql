ALTER TABLE "deals" ADD COLUMN "pickup_scheduled_on" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "pickup_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "pickup_scheduled_by" text;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pickup_scheduled_by_user_id_fk" FOREIGN KEY ("pickup_scheduled_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;