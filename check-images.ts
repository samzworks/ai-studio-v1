
import 'dotenv/config'; // Load .env file
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

async function checkImages() {
    console.log('Fetching recent images...');
    try {
        // Test connection first
        await db.execute(sql`SELECT 1`);
        console.log('Database connected.');

        const images = await db.query.images.findMany({
            limit: 5,
            orderBy: (images, { desc }) => [desc(images.createdAt)],
        });

        console.log('Recent images:');
        images.forEach(img => {
            console.log(`ID: ${img.id}, URL: ${img.url}`);
        });
        process.exit(0);
    } catch (error) {
        console.error('Failed to fetch images:', error);
        process.exit(1);
    }
}

checkImages();
