import pool from './src/core/config/database.js';

async function inspectSchema() {
    try {
        console.log('--- Rooms Schema ---');
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'rooms'");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

inspectSchema();
