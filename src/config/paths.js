import { join } from 'path';

const dataDir = process.env.DATA_DIR || process.cwd();
export const CONFIG_FILE = join(dataDir, 'clients.json');
