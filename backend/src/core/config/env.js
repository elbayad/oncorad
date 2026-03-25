import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Charge les variables d'environnement depuis plusieurs emplacements possibles
 * pour assurer une robustesse maximale quel que soit le répertoire de démarrage.
 */
function loadEnv() {
    const possiblePaths = [
        path.resolve(process.cwd(), '.env'),           // CWD
        path.resolve(__dirname, '../../../.env'),      // backend/.env (from src/core/config)
        path.resolve(__dirname, '../../../../.env'),   // project root .env
    ];

    let found = false;
    for (const envPath of possiblePaths) {
        if (fs.existsSync(envPath)) {
            // console.log(`[Env] Loading variables from: ${envPath}`);
            dotenv.config({ path: envPath });
            found = true;
            break;
        }
    }

    if (!found) {
        console.warn('⚠️ [Env] No .env file found in standard locations. Using process defaults.');
        dotenv.config(); // Fallback to default behavior
    }
}

loadEnv();

export default process.env;
