ALTER TYPE "public"."manager_subscription_status" ADD VALUE IF NOT EXISTS 'trialing';--> statement-breakpoint
ALTER TABLE "manager_subscriptions" DROP CONSTRAINT "manager_subscriptions_revenuecat_app_user_id_unique";--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "manager_subscriptions" DROP COLUMN "revenuecat_app_user_id";--> statement-breakpoint
ALTER TABLE "manager_subscriptions" DROP COLUMN "product_id";--> statement-breakpoint
ALTER TABLE "manager_subscriptions" DROP COLUMN "original_transaction_id";--> statement-breakpoint
ALTER TABLE "manager_subscriptions" DROP COLUMN "store";--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD CONSTRAINT "manager_subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD CONSTRAINT "manager_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id");--> statement-breakpoint
DROP TYPE "public"."manager_subscription_store";