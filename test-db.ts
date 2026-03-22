
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

async function checkDb() {
    console.log('Testing database connection...');
    try {
        const result = await db.execute(sql`SELECT 1`);
        console.log('Database connection successful:', result);
        process.exit(0);
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
}

checkDb();
