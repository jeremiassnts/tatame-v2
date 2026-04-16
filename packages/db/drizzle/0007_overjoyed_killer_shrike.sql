CREATE TYPE "public"."manager_subscription_store" AS ENUM('app_store', 'play_store');--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD COLUMN "revenuecat_app_user_id" text;--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD COLUMN "product_id" text;--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD COLUMN "original_transaction_id" text;--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD COLUMN "store" "manager_subscription_store";--> statement-breakpoint
ALTER TABLE "manager_subscriptions" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "manager_subscriptions" DROP COLUMN "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "manager_subscriptions" ADD CONSTRAINT "manager_subscriptions_revenuecat_app_user_id_unique" UNIQUE("revenuecat_app_user_id");