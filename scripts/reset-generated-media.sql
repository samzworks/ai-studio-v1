BEGIN;

-- Remove curated gallery references that point to generated image/video records.
DELETE FROM homepage_featured_items
WHERE item_type IN ('image', 'video');

DELETE FROM public_gallery_items
WHERE item_type IN ('image', 'video');

-- Remove film studio links to generated media before deleting base rows.
UPDATE scene_versions
SET image_id = NULL,
    image_url = NULL
WHERE image_id IS NOT NULL
   OR image_url IS NOT NULL;

UPDATE scene_versions
SET video_id = NULL,
    video_url = NULL,
    job_id = NULL
WHERE video_id IS NOT NULL
   OR video_url IS NOT NULL
   OR job_id IS NOT NULL;

-- Clear generation job history first to avoid FK blocks.
DELETE FROM upscale_jobs;
DELETE FROM image_generation_jobs;

-- Clear generated media and related job history.
DELETE FROM videos;
DELETE FROM video_jobs;
DELETE FROM images;

-- Reset identity sequences for fresh IDs.
SELECT setval(pg_get_serial_sequence('images', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('videos', 'id'), 1, false);
COMMIT;
