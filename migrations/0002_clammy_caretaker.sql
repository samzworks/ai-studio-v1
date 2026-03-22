CREATE TABLE "annual_plan_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"monthly_plan_id" integer NOT NULL,
	"annual_plan_id" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "annual_plan_variants_monthly_plan_id_unique" UNIQUE("monthly_plan_id")
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"message" text NOT NULL,
	"status" varchar DEFAULT 'unread' NOT NULL,
	"admin_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"coupon_id" integer NOT NULL,
	"applied_to" varchar NOT NULL,
	"reference_id" varchar NOT NULL,
	"discount_amount_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar NOT NULL,
	"name" varchar,
	"description" text,
	"type" varchar NOT NULL,
	"value" integer NOT NULL,
	"applies_to" varchar DEFAULT 'both' NOT NULL,
	"allowed_plan_ids" jsonb,
	"max_redemptions" integer,
	"max_redemptions_per_user" integer DEFAULT 1,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"min_purchase_cents" integer,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"source_type" varchar NOT NULL,
	"source_id" varchar,
	"amount" integer NOT NULL,
	"balance_after" integer,
	"expires_at" timestamp,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_pack_display_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"pack_id" integer NOT NULL,
	"badge_text" varchar,
	"badge_text_ar" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "credit_pack_display_overrides_pack_id_unique" UNIQUE("pack_id")
);
--> statement-breakpoint
CREATE TABLE "credit_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"requested_amount" integer NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"approved_amount" integer,
	"credit_transaction_id" integer,
	"admin_note" text,
	"processed_by" varchar,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hero_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"desktop_video_url" text NOT NULL,
	"mobile_video_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_cta" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"button_text" varchar NOT NULL,
	"button_url" text NOT NULL,
	"background_image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_featured_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_type" varchar NOT NULL,
	"item_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_promotion_bar" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"button_text" varchar,
	"button_url" text,
	"background_color" varchar DEFAULT '#1a1a2e',
	"text_color" varchar DEFAULT '#ffffff',
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_service_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"title_ar" varchar,
	"description" text NOT NULL,
	"description_ar" text,
	"image_url" text,
	"link_url" text,
	"link_type" varchar DEFAULT 'internal' NOT NULL,
	"modal_type" varchar,
	"initial_model" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_generation_jobs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"owner_id" varchar NOT NULL,
	"prompt" text NOT NULL,
	"prompt_preview" varchar(100) NOT NULL,
	"width" integer DEFAULT 1024 NOT NULL,
	"height" integer DEFAULT 1024 NOT NULL,
	"aspect_ratio" text DEFAULT '1:1',
	"model" text DEFAULT 'flux-pro' NOT NULL,
	"provider" text DEFAULT 'replicate' NOT NULL,
	"style" text DEFAULT 'Realistic',
	"quality" text DEFAULT 'standard',
	"negative_prompt" text,
	"seed" integer,
	"steps" integer,
	"cfg_scale" real,
	"style_image_url" text,
	"style_image_urls" text[],
	"image_strength" real,
	"enhance_prompt" boolean DEFAULT false,
	"tags" text[] DEFAULT '{}',
	"status" varchar DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"stage" text DEFAULT 'Queued',
	"queue_position" integer,
	"result_image_id" integer,
	"result_url" text,
	"error" text,
	"credits_used" integer,
	"cost_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_display_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"badge_text" varchar,
	"badge_text_ar" varchar,
	"marketing_label" varchar,
	"marketing_label_ar" varchar,
	"highlight_features" jsonb DEFAULT '[]'::jsonb,
	"highlight_features_ar" jsonb DEFAULT '[]'::jsonb,
	"annual_savings_percent" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "plan_display_overrides_plan_id_unique" UNIQUE("plan_id")
);
--> statement-breakpoint
CREATE TABLE "pricing_comparison_cells" (
	"id" serial PRIMARY KEY NOT NULL,
	"row_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"value_boolean" boolean,
	"value_text" varchar,
	"value_text_ar" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_comparison_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"label" varchar NOT NULL,
	"label_ar" varchar,
	"description" text,
	"description_ar" text,
	"row_type" varchar DEFAULT 'boolean' NOT NULL,
	"entitlement_key" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_comparison_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"title_ar" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_faq_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"question_ar" text,
	"answer" text NOT NULL,
	"answer_ar" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_page_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"nav_visible" boolean DEFAULT true NOT NULL,
	"page_title" varchar DEFAULT 'Choose Your Plan' NOT NULL,
	"page_title_ar" varchar DEFAULT 'اختر خطتك',
	"page_subtitle" text DEFAULT 'Unlock the full power of AI-generated images and videos',
	"page_subtitle_ar" text DEFAULT 'أطلق العنان للقوة الكاملة للصور ومقاطع الفيديو المولدة بالذكاء الاصطناعي',
	"small_note" text,
	"small_note_ar" text,
	"default_billing_view" varchar DEFAULT 'monthly' NOT NULL,
	"featured_plan_id" integer,
	"show_credit_packs" boolean DEFAULT true NOT NULL,
	"subscription_coming_soon" boolean DEFAULT false NOT NULL,
	"coming_soon_message" text DEFAULT 'Coming soon, we are currently in beta testing stage',
	"coming_soon_message_ar" text DEFAULT 'قريباً، نحن حالياً في مرحلة الاختبار التجريبي',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teaser_gallery_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"caption_en" varchar NOT NULL,
	"caption_ar" varchar NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teaser_showcase_video" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_url" text NOT NULL,
	"caption_en" varchar DEFAULT 'Culturally aligned visuals' NOT NULL,
	"caption_ar" varchar DEFAULT 'صور متوافقة ثقافيًا' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topup_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"credits_amount" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" varchar DEFAULT 'usd' NOT NULL,
	"expires_in_days" integer DEFAULT 90 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"stripe_price_id" varchar,
	"stripe_product_id" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topup_packs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "topup_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"pack_id" integer NOT NULL,
	"credits_granted" integer NOT NULL,
	"price_paid_cents" integer NOT NULL,
	"currency" varchar DEFAULT 'usd' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"stripe_payment_intent_id" varchar,
	"stripe_session_id" varchar,
	"coupon_id" integer,
	"status" varchar DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upgrade_reason_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"reason_key" varchar NOT NULL,
	"title" varchar NOT NULL,
	"title_ar" varchar,
	"description" text NOT NULL,
	"description_ar" text,
	"icon" varchar,
	"recommended_plan_id" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL,
	CONSTRAINT "upgrade_reason_mappings_reason_key_unique" UNIQUE("reason_key")
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" ALTER COLUMN "credits_per_month" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "job_id" varchar;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "is_free" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "billing_period_months" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "currency" varchar DEFAULT 'usd' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "included_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "credit_expiry_policy" varchar DEFAULT 'expires_end_of_period_no_rollover' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "feature_flags" jsonb DEFAULT '{"image_generation":true,"video_generation":false,"film_studio":false,"can_make_private":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "stripe_price_id" varchar;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "stripe_product_id" varchar;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "annual_price_cents" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "annual_stripe_price_id" varchar;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "stripe_customer_id" varchar;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "stripe_subscription_id" varchar;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "canceled_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "trial_end" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "free_generation_consent_at" timestamp;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN "video_reference_url" text;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN "character_orientation" text DEFAULT 'video';--> statement-breakpoint
ALTER TABLE "annual_plan_variants" ADD CONSTRAINT "annual_plan_variants_monthly_plan_id_subscription_plans_id_fk" FOREIGN KEY ("monthly_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_plan_variants" ADD CONSTRAINT "annual_plan_variants_annual_plan_id_subscription_plans_id_fk" FOREIGN KEY ("annual_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_plan_variants" ADD CONSTRAINT "annual_plan_variants_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_pack_display_overrides" ADD CONSTRAINT "credit_pack_display_overrides_pack_id_topup_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."topup_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_pack_display_overrides" ADD CONSTRAINT "credit_pack_display_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_credit_transaction_id_credit_transactions_id_fk" FOREIGN KEY ("credit_transaction_id") REFERENCES "public"."credit_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_cta" ADD CONSTRAINT "homepage_cta_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_featured_items" ADD CONSTRAINT "homepage_featured_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_promotion_bar" ADD CONSTRAINT "homepage_promotion_bar_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_service_cards" ADD CONSTRAINT "homepage_service_cards_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_generation_jobs" ADD CONSTRAINT "image_generation_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_generation_jobs" ADD CONSTRAINT "image_generation_jobs_result_image_id_images_id_fk" FOREIGN KEY ("result_image_id") REFERENCES "public"."images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_display_overrides" ADD CONSTRAINT "plan_display_overrides_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_display_overrides" ADD CONSTRAINT "plan_display_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_comparison_cells" ADD CONSTRAINT "pricing_comparison_cells_row_id_pricing_comparison_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."pricing_comparison_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_comparison_cells" ADD CONSTRAINT "pricing_comparison_cells_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_comparison_cells" ADD CONSTRAINT "pricing_comparison_cells_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_comparison_rows" ADD CONSTRAINT "pricing_comparison_rows_section_id_pricing_comparison_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."pricing_comparison_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_comparison_rows" ADD CONSTRAINT "pricing_comparison_rows_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_comparison_sections" ADD CONSTRAINT "pricing_comparison_sections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_faq_items" ADD CONSTRAINT "pricing_faq_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_page_config" ADD CONSTRAINT "pricing_page_config_featured_plan_id_subscription_plans_id_fk" FOREIGN KEY ("featured_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_page_config" ADD CONSTRAINT "pricing_page_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topup_purchases" ADD CONSTRAINT "topup_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topup_purchases" ADD CONSTRAINT "topup_purchases_pack_id_topup_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."topup_packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topup_purchases" ADD CONSTRAINT "topup_purchases_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upgrade_reason_mappings" ADD CONSTRAINT "upgrade_reason_mappings_recommended_plan_id_subscription_plans_id_fk" FOREIGN KEY ("recommended_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upgrade_reason_mappings" ADD CONSTRAINT "upgrade_reason_mappings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_annual_plan_variants_monthly_plan_id" ON "annual_plan_variants" USING btree ("monthly_plan_id");--> statement-breakpoint
CREATE INDEX "idx_annual_plan_variants_annual_plan_id" ON "annual_plan_variants" USING btree ("annual_plan_id");--> statement-breakpoint
CREATE INDEX "idx_contact_submissions_status" ON "contact_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_contact_submissions_created_at" ON "contact_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_coupon_redemptions_user_id" ON "coupon_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_redemptions_coupon_id" ON "coupon_redemptions" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "idx_coupons_code" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_coupons_is_active" ON "coupons" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_credit_ledger_user_id" ON "credit_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_ledger_source_type" ON "credit_ledger" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_credit_ledger_expires_at" ON "credit_ledger" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_credit_ledger_created_at" ON "credit_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_credit_pack_display_overrides_pack_id" ON "credit_pack_display_overrides" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "idx_credit_pack_display_overrides_sort_order" ON "credit_pack_display_overrides" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_credit_requests_user_id" ON "credit_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_requests_status" ON "credit_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_credit_requests_created_at" ON "credit_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_homepage_featured_items_sort_order" ON "homepage_featured_items" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_homepage_featured_items_type" ON "homepage_featured_items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "idx_homepage_service_cards_sort_order" ON "homepage_service_cards" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_image_jobs_owner_id" ON "image_generation_jobs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_image_jobs_status" ON "image_generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_image_jobs_created_at" ON "image_generation_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_image_jobs_queue_position" ON "image_generation_jobs" USING btree ("queue_position");--> statement-breakpoint
CREATE INDEX "idx_plan_display_overrides_plan_id" ON "plan_display_overrides" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_plan_display_overrides_sort_order" ON "plan_display_overrides" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_pricing_comparison_cells_row_id" ON "pricing_comparison_cells" USING btree ("row_id");--> statement-breakpoint
CREATE INDEX "idx_pricing_comparison_cells_plan_id" ON "pricing_comparison_cells" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_pricing_comparison_rows_section_id" ON "pricing_comparison_rows" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_pricing_comparison_rows_sort_order" ON "pricing_comparison_rows" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_pricing_comparison_sections_sort_order" ON "pricing_comparison_sections" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_pricing_faq_items_sort_order" ON "pricing_faq_items" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_teaser_gallery_sort_order" ON "teaser_gallery_items" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_topup_purchases_user_id" ON "topup_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_topup_purchases_status" ON "topup_purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_notifications_user_id" ON "user_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_notifications_is_read" ON "user_notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_user_notifications_created_at" ON "user_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_user_id" ON "user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_status" ON "user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_stripe_subscription_id" ON "user_subscriptions" USING btree ("stripe_subscription_id");