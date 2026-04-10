CREATE TYPE "public"."pix_key_type" AS ENUM('cpf', 'email', 'phone', 'random');--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "pix_key" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "pix_key_type" "pix_key_type";