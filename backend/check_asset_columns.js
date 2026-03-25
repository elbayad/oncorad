import pool from './src/core/config/database.js';

async function checkAssetColumns() {
    try {
        const res = await pool.query("SELECT * FROM assets LIMIT 1");
        console.log(Object.keys(res.rows[0]));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkAssetColumns();
