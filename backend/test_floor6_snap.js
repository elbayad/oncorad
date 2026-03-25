import pool from './src/core/config/database.js';

async function testFloor6Snapping() {
    try {
        console.log('--- FETCHING ROOMS DATA FOR FLOOR 6 ---');
        const roomsRes = await pool.query(`
            SELECT id, room_number, anchor_x, anchor_y, is_active 
            FROM rooms 
            WHERE floor_id = 6 AND is_active = true
        `);
        console.table(roomsRes.rows);

        console.log('\n--- FETCHING ASSETS ON FLOOR 6 WITH ROOM ASSIGNED ---');
        const assetsRes = await pool.query(`
            SELECT a.id, a.name, a.room_id, r.room_number, a.coordinates_x, a.coordinates_y 
            FROM assets a
            JOIN rooms r ON a.room_id = r.id
            WHERE a.floor_id = 6 AND a.room_id IS NOT NULL
        `);
        console.table(assetsRes.rows);

        if (assetsRes.rows.length === 0) {
            console.warn('No assets found on floor 6 with a room_id assigned.');
        } else {
            // Check if coordinates match the room anchors
            console.log('\n--- VERIFYING COORDINATES MATCH ---');
            assetsRes.rows.forEach(asset => {
                const room = roomsRes.rows.find(r => r.id === asset.room_id);
                if (room) {
                    const ax = parseFloat(room.centroid_x || room.anchor_x || 0);
                    const ay = parseFloat(room.centroid_y || room.anchor_y || 0);
                    const distance = Math.sqrt(Math.pow(asset.coordinates_x - ax, 2) + Math.pow(asset.coordinates_y - ay, 2));
                    console.log(`Asset ${asset.id} (${asset.name}) in ${asset.room_number}: Dist to anchor = ${distance.toFixed(2)} cm`);
                }
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

testFloor6Snapping();
