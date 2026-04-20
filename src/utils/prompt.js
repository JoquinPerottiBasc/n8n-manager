import { select, input } from '@inquirer/prompts';
import { loadConfig } from '../config/store.js';
import { fetchAllPages } from '../api/client.js';
import { getClient } from '../config/store.js';

export async function selectClient() {
  const { clients } = loadConfig();
  if (clients.length === 0) {
    throw new Error('No clients configured. Run: n8n-manager client add');
  }
  if (clients.length === 1) return clients[0].name;

  return select({
    message: 'Select a client:',
    choices: clients.map(c => ({ name: `${c.name} (${c.url})`, value: c.name })),
  });
}

export async function selectWorkflow(clientName) {
  const client = getClient(clientName);
  const workflows = await fetchAllPages(client, '/workflows');

  if (workflows.length === 0) {
    throw new Error(`No workflows found for client "${clientName}"`);
  }

  return select({
    message: 'Select a workflow:',
    choices: workflows.map(w => ({
      name: `[${w.id}] ${w.name} (${w.active ? 'active' : 'inactive'})`,
      value: w.id,
    })),
  });
}

export { input };
