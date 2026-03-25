import pool from './src/core/config/database.js';

async function checkRoomsActive() {
    try {
        const res = await pool.query("SELECT id, room_number, is_active FROM rooms WHERE floor_id = 6");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkRoomsActive();
