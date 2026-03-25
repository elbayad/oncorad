import pool from './src/core/config/database.js';

async function debugSnap() {
    try {
        console.log('--- Floors ---');
        const floors = await pool.query("SELECT id, name FROM floors");
        console.table(floors.rows);

        const floor6 = floors.rows.find(f => f.name.includes('6'));
        if (!floor6) {
            console.log('No floor found with "6" in name');
            process.exit(0);
        }
        const floorId = floor6.id;
        console.log(`Checking Floor ID: ${floorId} (${floor6.name})`);

        console.log('\n--- Assets on Floor 6 ---');
        const assets = await pool.query("SELECT id, name, room_id, room FROM assets WHERE floor_id = $1", [floorId]);
        console.table(assets.rows);

        console.log('\n--- Rooms on Floor 6 ---');
        const rooms = await pool.query("SELECT id, room_number as name, anchor_x, anchor_y FROM rooms WHERE floor_id = $1", [floorId]);
        console.table(rooms.rows);

        console.log('\n--- Check for room_id assignment (Assets with NULL room_id) ---');
        const nullRooms = assets.rows.filter(a => !a.room_id);
        console.log(`Assets without room_id: ${nullRooms.length}`);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

debugSnap();
