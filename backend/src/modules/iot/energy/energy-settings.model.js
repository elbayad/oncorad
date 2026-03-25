import pool from '../../../core/config/database.js';

class EnergySettings {
    static async getSettings() {
        try {
            const result = await pool.query('SELECT * FROM public.energy_settings LIMIT 1');
            if (result.rows.length === 0) {
                // Initialize with default values if empty
                const defaultSettings = await this.initializeDefaults();
                return defaultSettings;
            }
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error getting energy settings: ${error.message}`);
        }
    }

    static async initializeDefaults() {
        try {
            const query = `
        INSERT INTO public.energy_settings (
          winter_creuses_start, winter_creuses_end, winter_pleines_start, winter_pleines_end, 
          winter_pointe_start, winter_pointe_end, winter_creuses_start2, winter_creuses_end2,
          summer_creuses_start, summer_creuses_end, summer_pleines_start, summer_pleines_end,
          summer_pointe_start, summer_pointe_end, summer_creuses_start2, summer_creuses_end2,
          winter_creuses_price, winter_pleines_price, winter_pointe_price,
          summer_creuses_price, summer_pleines_price, summer_pointe_price
        ) VALUES (
          0, 7, 7, 17, 17, 22, 22, 24,
          0, 7, 7, 18, 18, 23, 23, 24,
          0.65831, 0.93594, 1.38584,
          0.65831, 0.93594, 1.38584
        ) RETURNING *`;
            const result = await pool.query(query);
            return result.rows[0];
        } catch (error) {
            console.error('Error initializing default energy settings:', error);
            return null;
        }
    }

    static async updateSettings(data) {
        const {
            winter_creuses_start, winter_creuses_end, winter_pleines_start, winter_pleines_end,
            winter_pointe_start, winter_pointe_end, winter_creuses_start2, winter_creuses_end2,
            summer_creuses_start, summer_creuses_end, summer_pleines_start, summer_pleines_end,
            summer_pointe_start, summer_pointe_end, summer_creuses_start2, summer_creuses_end2,
            winter_creuses_price, winter_pleines_price, winter_pointe_price,
            summer_creuses_price, summer_pleines_price, summer_pointe_price
        } = data;

        try {
            // Check if we have a row to update
            const check = await pool.query('SELECT id FROM public.energy_settings LIMIT 1');
            if (check.rows.length === 0) {
                await this.initializeDefaults();
            }

            const query = `
        UPDATE public.energy_settings
        SET 
          winter_creuses_start = $1, winter_creuses_end = $2, winter_pleines_start = $3, winter_pleines_end = $4,
          winter_pointe_start = $5, winter_pointe_end = $6, winter_creuses_start2 = $7, winter_creuses_end2 = $8,
          summer_creuses_start = $9, summer_creuses_end = $10, summer_pleines_start = $11, summer_pleines_end = $12,
          summer_pointe_start = $13, summer_pointe_end = $14, summer_creuses_start2 = $15, summer_creuses_end2 = $16,
          winter_creuses_price = $17, winter_pleines_price = $18, winter_pointe_price = $19,
          summer_creuses_price = $20, summer_pleines_price = $21, summer_pointe_price = $22,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM public.energy_settings LIMIT 1)
        RETURNING *`;

            const values = [
                winter_creuses_start, winter_creuses_end, winter_pleines_start, winter_pleines_end,
                winter_pointe_start, winter_pointe_end, winter_creuses_start2, winter_creuses_end2,
                summer_creuses_start, summer_creuses_end, summer_pleines_start, summer_pleines_end,
                summer_pointe_start, summer_pointe_end, summer_creuses_start2, summer_creuses_end2,
                winter_creuses_price, winter_pleines_price, winter_pointe_price,
                summer_creuses_price, summer_pleines_price, summer_pointe_price
            ];

            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error updating energy settings: ${error.message}`);
        }
    }
}

export default EnergySettings;
