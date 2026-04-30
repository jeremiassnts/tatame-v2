CREATE TYPE "public"."notification_category" AS ENUM('class_change', 'payment', 'belt_promotion', 'announcement', 'marketplace', 'tournament', 'new_member', 'subscription_alert', 'checkin_anomaly', 'streak', 'inactivity', 'milestone', 'weekly_summary', 'wrapped');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."push_token_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" "notification_category" NOT NULL,
	"data" jsonb,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"academy_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"platform" "push_token_platform" NOT NULL,
	"device_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_clerk_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_recipient_read_idx" ON "notifications" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_user_device_unique" ON "push_tokens" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens" USING btree ("user_id");