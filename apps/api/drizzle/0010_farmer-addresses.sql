CREATE TABLE "farmer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farmer_addresses_label_length_check" CHECK (length(trim("farmer_addresses"."label")) between 1 and 40),
	CONSTRAINT "farmer_addresses_address_length_check" CHECK (length(trim("farmer_addresses"."address")) between 5 and 500)
);
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "pickup_location" text;--> statement-breakpoint
ALTER TABLE "farmer_addresses" ADD CONSTRAINT "farmer_addresses_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "farmer_addresses_farmer_idx" ON "farmer_addresses" USING btree ("farmer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "farmer_addresses_one_default_idx" ON "farmer_addresses" USING btree ("farmer_id") WHERE "farmer_addresses"."is_default";