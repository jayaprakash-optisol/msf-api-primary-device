CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packing_number" integer NOT NULL,
	"dispatch_reference" varchar NOT NULL,
	"customer_receiver_code" varchar NOT NULL,
	"order_reference" integer NOT NULL,
	"transport_mode" varchar NOT NULL,
	"packing_status" varchar NOT NULL,
	"field_reference" varchar NOT NULL,
	"supplier_name" varchar NOT NULL,
	"notes" varchar,
	"message_esc1" varchar,
	"freight" varchar NOT NULL,
	"origin" varchar NOT NULL,
	"source_system" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unidata_id" uuid,
	"product_code" varchar(50),
	"type" varchar(50),
	"state" varchar(50),
	"standardization_level" varchar(50),
	"labels" json,
	"source_system" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_weight" numeric(9, 3),
	"package_volume" numeric(9, 3),
	"first_parcel_number" integer,
	"last_parcel_number" integer,
	"total_number_of_parcels" integer NOT NULL,
	"parcel_from" integer NOT NULL,
	"parcel_to" integer NOT NULL,
	"parcel_quantity" integer NOT NULL,
	"total_weight" numeric(9, 3) NOT NULL,
	"total_volume" numeric(9, 3) NOT NULL,
	"total_height" numeric(9, 3) NOT NULL,
	"total_length" numeric(9, 3) NOT NULL,
	"total_width" numeric(9, 3) NOT NULL,
	"packing_list_number" varchar(50) NOT NULL,
	"message_esc1" varchar(255),
	"message_esc2" varchar(255),
	"source_system" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcel_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"product_quantity" integer NOT NULL,
	"product_code" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"expiry_date" timestamp NOT NULL,
	"batch_number" varchar(50) NOT NULL,
	"external_ref" varchar(50) NOT NULL,
	"unit_of_measure" varchar(50) NOT NULL,
	"currency_unit" varchar(50) NOT NULL,
	"unit_price" numeric NOT NULL,
	"message_esc1" varchar(255),
	"message_esc2" varchar(255),
	"comments" varchar(255),
	"contains" varchar(255),
	"source_system" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parcel_items" ADD CONSTRAINT "parcel_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;