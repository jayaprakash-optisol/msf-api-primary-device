CREATE TYPE "public"."guest_role" AS ENUM('Stock Manager', 'Store Keeper');
CREATE TYPE "public"."guest_status" AS ENUM('Active', 'Inactive', 'Expired');
CREATE TYPE "public"."role" AS ENUM('Admin', 'User');

CREATE TABLE IF NOT EXISTS "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"location" varchar(100) NOT NULL,
	"role" "guest_role" NOT NULL,
	"access_period" varchar(50) NOT NULL,
	"username" varchar(100) NOT NULL,
	"password" varchar(255) NOT NULL,
	"status" "guest_status" DEFAULT 'Active' NOT NULL,
	"credentials_viewed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guests_username_unique" UNIQUE("username")
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"role" "role" DEFAULT 'User' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
