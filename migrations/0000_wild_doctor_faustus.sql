CREATE TABLE "admin_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" varchar NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_styles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"prompt_text" text NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"category" varchar DEFAULT 'general' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "ai_styles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"type" varchar NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"cost_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" varchar NOT NULL,
	"image_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "film_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"idea" text NOT NULL,
	"style" varchar DEFAULT 'cinematic' NOT NULL,
	"mood" varchar DEFAULT 'dramatic' NOT NULL,
	"cuts_style" varchar DEFAULT 'hard' NOT NULL,
	"target_duration" integer DEFAULT 30 NOT NULL,
	"aspect_ratio" varchar DEFAULT '16:9' NOT NULL,
	"camera_language" varchar DEFAULT 'cinematic' NOT NULL,
	"pacing" varchar DEFAULT 'medium' NOT NULL,
	"visual_era" varchar DEFAULT 'modern' NOT NULL,
	"final_film_url" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hero_slides" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"subtitle" text NOT NULL,
	"image_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_reference_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "image_reference_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "image_reference_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"filename" varchar NOT NULL,
	"path" text NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" varchar NOT NULL,
	"image_id" integer NOT NULL,
	"reason" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" varchar NOT NULL,
	"prompt" text NOT NULL,
	"url" text NOT NULL,
	"width" integer DEFAULT 1024 NOT NULL,
	"height" integer DEFAULT 1024 NOT NULL,
	"style" text DEFAULT 'photorealistic' NOT NULL,
	"model" text DEFAULT 'dall-e-3' NOT NULL,
	"quality" text DEFAULT 'standard' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}',
	"negative_prompt" text,
	"seed" integer,
	"steps" integer,
	"cfg_scale" real,
	"aspect_ratio" text,
	"provider" text DEFAULT 'openai' NOT NULL,
	"style_image_url" text,
	"image_strength" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation_id" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"model" varchar,
	"category" varchar NOT NULL,
	"unit_type" varchar NOT NULL,
	"base_cost_usd" real NOT NULL,
	"default_quantity" real DEFAULT 1 NOT NULL,
	"per_operation_margin_percent" real,
	"is_active" boolean DEFAULT true NOT NULL,
	"billing_mode" varchar,
	"rates" jsonb,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "pricing_operations_operation_id_unique" UNIQUE("operation_id")
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"feature_type" varchar NOT NULL,
	"feature_value" varchar NOT NULL,
	"credit_cost" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "pricing_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"category" varchar DEFAULT 'default' NOT NULL,
	"model_id" varchar,
	"prompt_text" text NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "prompt_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "random_prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"scene_id" integer NOT NULL,
	"version_type" varchar NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"title" varchar,
	"description" text,
	"notes" text,
	"image_prompt" text,
	"image_model" text DEFAULT 'fal-ai/flux-pro/v1.1',
	"image_style" text DEFAULT 'sketch',
	"image_url" text,
	"image_id" integer,
	"video_prompt" text,
	"video_url" text,
	"video_id" integer,
	"job_id" varchar,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"value" jsonb NOT NULL,
	"category" varchar NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "site_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "storyboard_scenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"scene_number" integer NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"notes" text,
	"suggested_duration" integer DEFAULT 5 NOT NULL,
	"selected_for_final" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"monthly_price" integer DEFAULT 0 NOT NULL,
	"credits_per_month" integer NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"namespace" varchar(50) DEFAULT 'common' NOT NULL,
	"english" text NOT NULL,
	"arabic" text NOT NULL,
	"last_modified_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "translations_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_credits" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"lifetime_spent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_id" integer NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"public_by_default" boolean DEFAULT false NOT NULL,
	"role" varchar DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "video_favorites" (
	"user_id" varchar NOT NULL,
	"video_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_jobs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"owner_id" varchar NOT NULL,
	"prompt" text NOT NULL,
	"duration" integer DEFAULT 5 NOT NULL,
	"width" integer DEFAULT 540 NOT NULL,
	"height" integer DEFAULT 960 NOT NULL,
	"aspect_ratio" text DEFAULT '9:16' NOT NULL,
	"model" text DEFAULT 'luma-ray-flash-2-540p' NOT NULL,
	"provider" text DEFAULT 'replicate' NOT NULL,
	"style" text DEFAULT 'cinematic' NOT NULL,
	"start_frame_url" text,
	"end_frame_url" text,
	"frame_rate" integer DEFAULT 24,
	"loop" boolean DEFAULT false,
	"audio_enabled" boolean DEFAULT false NOT NULL,
	"state" varchar DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"stage" text DEFAULT 'Queued' NOT NULL,
	"provider_id" text,
	"asset_url" text,
	"thumbnail_url" text,
	"error" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_model_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" varchar NOT NULL,
	"estimated_time_seconds" integer DEFAULT 60 NOT NULL,
	"custom_stage_labels" jsonb DEFAULT 'null'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "video_model_configs_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "video_styles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"prompt_text" text NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"category" varchar DEFAULT 'general' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "video_styles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" varchar NOT NULL,
	"prompt" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"duration" integer DEFAULT 5 NOT NULL,
	"width" integer DEFAULT 540 NOT NULL,
	"height" integer DEFAULT 960 NOT NULL,
	"aspect_ratio" text DEFAULT '9:16' NOT NULL,
	"model" text DEFAULT 'luma-ray-flash-2-540p' NOT NULL,
	"provider" text DEFAULT 'replicate' NOT NULL,
	"style" text DEFAULT 'cinematic' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}',
	"start_frame_url" text,
	"end_frame_url" text,
	"frame_rate" integer DEFAULT 24,
	"loop" boolean DEFAULT false,
	"audio_enabled" boolean DEFAULT false NOT NULL,
	"job_id" varchar,
	"replicate_id" text,
	"status" varchar DEFAULT 'completed' NOT NULL,
	"progress" integer DEFAULT 100,
	"stage" text,
	"eta_seconds" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_styles" ADD CONSTRAINT "ai_styles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_projects" ADD CONSTRAINT "film_projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_reference_categories" ADD CONSTRAINT "image_reference_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_reference_categories" ADD CONSTRAINT "image_reference_categories_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_reference_images" ADD CONSTRAINT "image_reference_images_category_id_image_reference_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."image_reference_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_reference_images" ADD CONSTRAINT "image_reference_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_reports" ADD CONSTRAINT "image_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_reports" ADD CONSTRAINT "image_reports_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_reports" ADD CONSTRAINT "image_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_operations" ADD CONSTRAINT "pricing_operations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_settings" ADD CONSTRAINT "pricing_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD CONSTRAINT "scene_versions_scene_id_storyboard_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."storyboard_scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD CONSTRAINT "scene_versions_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD CONSTRAINT "scene_versions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD CONSTRAINT "scene_versions_job_id_video_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."video_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storyboard_scenes" ADD CONSTRAINT "storyboard_scenes_project_id_film_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."film_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translations" ADD CONSTRAINT "translations_last_modified_by_users_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_favorites" ADD CONSTRAINT "video_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_favorites" ADD CONSTRAINT "video_favorites_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_model_configs" ADD CONSTRAINT "video_model_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_styles" ADD CONSTRAINT "video_styles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_job_id_video_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."video_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");