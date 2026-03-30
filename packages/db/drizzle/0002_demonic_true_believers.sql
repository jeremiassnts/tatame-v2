CREATE TYPE "public"."manager_plan" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."manager_subscription_status" AS ENUM('active', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TABLE "manager_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"plan" "manager_plan" NOT NULL,
	"status" "manager_subscription_status" NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_subscriptions_academy_id_unique" UNIQUE("academy_id")
);
--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD CONSTRAINT "manager_subscriptions_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;