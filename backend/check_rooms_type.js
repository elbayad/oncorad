import pool from './src/core/config/database.js';

async function checkRooms() {
    try {
        const res = await pool.query("SELECT id, room_number, type FROM rooms WHERE floor_id = 6");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkRooms();
