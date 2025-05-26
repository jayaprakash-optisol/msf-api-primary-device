ALTER TABLE "parcel_items" ALTER COLUMN "parcel_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ADD COLUMN "parcel_number" integer;