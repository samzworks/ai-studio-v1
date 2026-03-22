
import "dotenv/config";
import pg from 'pg';

async function checkSessionsTable() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL not set");
        process.exit(1);
    }

    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        const res = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions'
      );
    `);

        console.log("Sessions table exists:", res.rows[0].exists);

        if (res.rows[0].exists) {
            const countRes = await pool.query('SELECT count(*) FROM sessions');
            console.log("Session count:", countRes.rows[0].count);
        }

    } catch (err) {
        console.error("Error checking sessions table:", err);
    } finally {
        await pool.end();
    }
}

checkSessionsTable();
