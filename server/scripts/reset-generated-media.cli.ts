import { pool } from "../db";

async function run() {
  console.log("Resetting generated media references and records...");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      DELETE FROM homepage_featured_items
      WHERE item_type IN ('image', 'video');
    `);

    await client.query(`
      DELETE FROM public_gallery_items
      WHERE item_type IN ('image', 'video');
    `);

    await client.query(`
      UPDATE scene_versions
      SET image_id = NULL,
          image_url = NULL
      WHERE image_id IS NOT NULL
         OR image_url IS NOT NULL;
    `);

    await client.query(`
      UPDATE scene_versions
      SET video_id = NULL,
          video_url = NULL,
          job_id = NULL
      WHERE video_id IS NOT NULL
         OR video_url IS NOT NULL
         OR job_id IS NOT NULL;
    `);

    await client.query("DELETE FROM upscale_jobs;");
    await client.query("DELETE FROM image_generation_jobs;");
    await client.query("DELETE FROM videos;");
    await client.query("DELETE FROM video_jobs;");
    await client.query("DELETE FROM images;");

    await client.query(`
      SELECT setval(pg_get_serial_sequence('images', 'id'), 1, false);
    `);
    await client.query(`
      SELECT setval(pg_get_serial_sequence('videos', 'id'), 1, false);
    `);

    await client.query("COMMIT");
    console.log("Generated media reset completed.");
    process.exit(0);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to reset generated media:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
