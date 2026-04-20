import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CONFIG_FILE = join(process.cwd(), 'telegram.json');

export function loadTelegramConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveTelegramConfig(config) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export function getTelegramToken() {
  const config = loadTelegramConfig();
  if (!config.telegramToken) {
    throw new Error('Token de Telegram no configurado. Ejecutá: n8n-manager telegram setup');
  }
  return config.telegramToken;
}
