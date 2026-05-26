ALTER TYPE "public"."app_role" ADD VALUE 'guardian';
--> statement-breakpoint
CREATE TABLE "dependents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guardian_id" uuid NOT NULL,
	"academy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"birth_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "belt_promotions" ADD COLUMN "dependent_id" uuid;
--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "dependent_id" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "dependent_id" uuid;
--> statement-breakpoint
ALTER TABLE "student_subscriptions" ADD COLUMN "dependent_id" uuid;
--> statement-breakpoint
ALTER TABLE "dependents" ADD CONSTRAINT "dependents_guardian_id_users_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dependents" ADD CONSTRAINT "dependents_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "belt_promotions" ADD CONSTRAINT "belt_promotions_dependent_id_dependents_id_fk" FOREIGN KEY ("dependent_id") REFERENCES "public"."dependents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_dependent_id_dependents_id_fk" FOREIGN KEY ("dependent_id") REFERENCES "public"."dependents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_dependent_id_dependents_id_fk" FOREIGN KEY ("dependent_id") REFERENCES "public"."dependents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_subscriptions" ADD CONSTRAINT "student_subscriptions_dependent_id_dependents_id_fk" FOREIGN KEY ("dependent_id") REFERENCES "public"."dependents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "belt_promotions_one_current_per_dependent" ON "belt_promotions" USING btree ("dependent_id") WHERE "belt_promotions"."is_current" = true AND "belt_promotions"."dependent_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "checkins_dependent_class_date_unique" ON "checkins" USING btree ("dependent_id","class_id","date") WHERE "checkins"."dependent_id" IS NOT NULL;
