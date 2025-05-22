ALTER TABLE "shipments" ALTER COLUMN "packing_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "dispatch_reference" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "customer_receiver_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "order_reference" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "transport_mode" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "packing_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "field_reference" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "supplier_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "freight" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "origin" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "source_system" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "product_code" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "type" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "state" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "standardization_level" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "source_system" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "total_number_of_parcels" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "parcel_from" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "parcel_to" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "parcel_quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "total_weight" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "total_volume" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "total_height" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "total_length" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "total_width" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "packing_list_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ALTER COLUMN "product_quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ALTER COLUMN "product_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ALTER COLUMN "line_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ALTER COLUMN "expiry_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ALTER COLUMN "batch_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ALTER COLUMN "external_ref" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ALTER COLUMN "unit_of_measure" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ALTER COLUMN "currency_unit" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ALTER COLUMN "unit_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_description" varchar;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "purchase_order_number" varchar;--> statement-breakpoint
ALTER TABLE "parcel_items" ADD COLUMN "parcel_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel_items" ADD COLUMN "weight" numeric(9, 3);--> statement-breakpoint
ALTER TABLE "parcel_items" ADD COLUMN "volume" numeric(9, 3);--> statement-breakpoint
ALTER TABLE "parcel_items" ADD CONSTRAINT "parcel_items_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE no action ON UPDATE no action;