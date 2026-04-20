import { readFileSync, writeFileSync, existsSync } from 'fs';
import { CONFIG_FILE } from './paths.js';
import { ClientNotFoundError } from '../utils/errors.js';

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return { clients: [] };
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { clients: [] };
  }
}

function saveConfig(config) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function getClient(name) {
  const { clients } = loadConfig();
  const client = clients.find(c => c.name === name);
  if (!client) throw new ClientNotFoundError(name);
  return client;
}

function addClient(client) {
  const config = loadConfig();
  const existing = config.clients.findIndex(c => c.name === client.name);
  if (existing >= 0) {
    config.clients[existing] = client;
  } else {
    config.clients.push(client);
  }
  saveConfig(config);
}

function removeClient(name) {
  const config = loadConfig();
  const before = config.clients.length;
  config.clients = config.clients.filter(c => c.name !== name);
  if (config.clients.length === before) throw new ClientNotFoundError(name);
  saveConfig(config);
}

export { loadConfig, saveConfig, getClient, addClient, removeClient };
