CREATE TABLE "pending_asaas_payments" (
	"asaas_payment_id" text PRIMARY KEY NOT NULL,
	"subscription_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"academy_id" uuid NOT NULL,
	"reference_month" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "asaas_payment_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "asaas_customer_id" text;--> statement-breakpoint
ALTER TABLE "pending_asaas_payments" ADD CONSTRAINT "pending_asaas_payments_subscription_id_student_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."student_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_asaas_payments" ADD CONSTRAINT "pending_asaas_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_asaas_payments" ADD CONSTRAINT "pending_asaas_payments_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_asaas_payment_id_unique" UNIQUE("asaas_payment_id");