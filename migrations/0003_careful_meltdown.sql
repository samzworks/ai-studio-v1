CREATE TABLE "public_gallery_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_type" varchar NOT NULL,
	"item_id" integer NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_sticky_top" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
ALTER TABLE "public_gallery_items" ADD CONSTRAINT "public_gallery_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_public_gallery_items_sort_order" ON "public_gallery_items" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_public_gallery_items_type" ON "public_gallery_items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "idx_public_gallery_items_featured" ON "public_gallery_items" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "idx_public_gallery_items_sticky" ON "public_gallery_items" USING btree ("is_sticky_top");