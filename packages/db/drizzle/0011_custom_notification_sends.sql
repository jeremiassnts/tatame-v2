CREATE TABLE IF NOT EXISTS "custom_notification_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_notification_sends" ADD CONSTRAINT "custom_notification_sends_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_notification_sends" ADD CONSTRAINT "custom_notification_sends_sender_id_users_clerk_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_notification_sends_academy_created_idx" ON "custom_notification_sends" USING btree ("academy_id","created_at");
