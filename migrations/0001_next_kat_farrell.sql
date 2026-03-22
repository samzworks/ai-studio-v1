CREATE INDEX "idx_admin_logs_admin_id" ON "admin_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_admin_logs_created_at" ON "admin_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_user_id" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_type" ON "credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_created_at" ON "credit_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_images_owner_id" ON "images" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_images_is_public" ON "images" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_images_created_at" ON "images" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_video_jobs_owner_id" ON "video_jobs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_video_jobs_state" ON "video_jobs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_video_jobs_created_at" ON "video_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_videos_owner_id" ON "videos" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_videos_is_public" ON "videos" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_videos_created_at" ON "videos" USING btree ("created_at");