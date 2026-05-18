ALTER TABLE "custom_notification_sends" DROP CONSTRAINT "custom_notification_sends_sender_id_users_clerk_user_id_fk";
--> statement-breakpoint
ALTER TABLE "custom_notification_sends" ALTER COLUMN "sender_id" SET DATA TYPE uuid USING "sender_id"::uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_notification_sends" ADD CONSTRAINT "custom_notification_sends_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
