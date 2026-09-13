CREATE TABLE "child_parents" (
	"child_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "child_parents_child_id_user_id_pk" PRIMARY KEY("child_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"surname" text DEFAULT '' NOT NULL,
	"classroom" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "children_classroom_valid" CHECK ("children"."classroom" = ANY (ARRAY['KK0','KK1','KK2','KK3','L1','L2A','L2B','L3','L4','L5A','L5B','L6']))
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"maaltijd" text[] DEFAULT '{}'::text[] NOT NULL,
	"maaltijd_datums" text[] DEFAULT '{}'::text[] NOT NULL,
	"maaltijd_maand" text,
	"maaltijd_bericht" text,
	"inschrijvingen" text,
	"welkom" text,
	"schoolreglement" text,
	"team_foto" text,
	"team_directeur" text,
	"team_administratie" text,
	"team_kleuterschool" text,
	"team_lagere_school" text,
	"team_ambulant" text,
	"team_zorg" text,
	"team_gym" text,
	"team_onderhoud" text,
	"benodigdheden_kk0" text,
	"benodigdheden_kk1" text,
	"benodigdheden_kk2" text,
	"benodigdheden_kk3" text,
	"benodigdheden_l1" text,
	"benodigdheden_l2" text,
	"benodigdheden_l3" text,
	"benodigdheden_l4" text,
	"benodigdheden_l5" text,
	"benodigdheden_l6" text,
	"bestuur_voorzitter" text,
	"bestuur_leden" text,
	"ondersteuning_vestiging" text,
	"ondersteuning_voorwaarden" text,
	"ziekte" text,
	"opvang" text,
	"clb_coordinator" text,
	"clb_medewerkers" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"succeeded" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_type" text NOT NULL,
	"status" text DEFAULT 'Besteld' NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"created_by_id" text,
	"created_for_id" text,
	"created_by_name" text,
	"created_by_surname" text,
	"created_by_email" text,
	"created_for_name" text,
	"created_for_surname" text,
	"created_for_classroom" text,
	"color" text,
	"size" text,
	"consumption_month" text,
	"consumption_dates" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_type_valid" CHECK ("orders"."order_type" = ANY (ARRAY['Drankkaart','Badmuts','Gym T-shirt','Maaltijd'])),
	CONSTRAINT "orders_status_valid" CHECK ("orders"."status" = ANY (ARRAY['Besteld','Uitgedeeld','Gefactureerd'])),
	CONSTRAINT "orders_quantity_positive" CHECK ("orders"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_likes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"post_title" text DEFAULT '' NOT NULL,
	"post_description" text DEFAULT '' NOT NULL,
	"post_photo" text,
	"album_url" text,
	"external_url" text,
	"classroom" text[] DEFAULT '{}'::text[] NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"post_user_id" text,
	"time_posted" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"surname" text,
	"phone_number" text,
	"photo_url" text,
	"admin" boolean DEFAULT false NOT NULL,
	"teacher" boolean DEFAULT false NOT NULL,
	"teacher_classroom" text[] DEFAULT '{}'::text[] NOT NULL,
	"password_hash" text,
	"legacy_firebase_hash" text,
	"legacy_firebase_salt" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_time" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_parents" ADD CONSTRAINT "child_parents_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_parents" ADD CONSTRAINT "child_parents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_for_id_children_id_fk" FOREIGN KEY ("created_for_id") REFERENCES "public"."children"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_post_user_id_users_id_fk" FOREIGN KEY ("post_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "child_parents_user_idx" ON "child_parents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "children_classroom_idx" ON "children" USING btree ("classroom");--> statement-breakpoint
CREATE INDEX "login_attempts_bucket_idx" ON "login_attempts" USING btree ("bucket","attempted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_type_status_idx" ON "orders" USING btree ("order_type","status");--> statement-breakpoint
CREATE INDEX "orders_created_by_idx" ON "orders" USING btree ("created_by_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_created_for_idx" ON "orders" USING btree ("created_for_id");--> statement-breakpoint
CREATE INDEX "orders_classroom_idx" ON "orders" USING btree ("created_for_classroom");--> statement-breakpoint
CREATE INDEX "orders_month_idx" ON "orders" USING btree ("consumption_month");--> statement-breakpoint
CREATE INDEX "prt_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "prt_expires_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "post_likes_user_idx" ON "post_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_time_posted_idx" ON "posts" USING btree ("time_posted" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_pinned_time_idx" ON "posts" USING btree ("pinned" DESC NULLS LAST,"time_posted" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_classroom_gin_idx" ON "posts" USING gin ("classroom");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_admin_idx" ON "users" USING btree ("admin") WHERE "users"."admin";--> statement-breakpoint
CREATE INDEX "users_teacher_idx" ON "users" USING btree ("teacher") WHERE "users"."teacher";