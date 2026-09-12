CREATE TYPE "public"."payout_account_status" AS ENUM('pending', 'awaiting_documents', 'under_review', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE "academy_payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"provider" text DEFAULT 'asaas' NOT NULL,
	"external_account_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"status" "payout_account_status" NOT NULL,
	"general_status" text,
	"commercial_info_status" text,
	"document_status" text,
	"bank_account_info_status" text,
	"onboarding_url" text,
	"rejection_reason" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academy_payout_accounts_academy_id_unique" UNIQUE("academy_id")
);
--> statement-breakpoint
ALTER TABLE "academy_payout_accounts" ADD CONSTRAINT "academy_payout_accounts_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "academy_payout_accounts_external_account_id" ON "academy_payout_accounts" USING btree ("external_account_id");