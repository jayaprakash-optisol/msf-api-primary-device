ALTER TABLE "products" ALTER COLUMN "unidata_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "parcel_items" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "free_code" varchar;