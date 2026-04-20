import { Command } from 'commander';
import { input } from '@inquirer/prompts';
import ora from 'ora';
import { loadConfig, addClient, removeClient } from '../config/store.js';
import { apiRequest } from '../api/client.js';
import { printTable, printSuccess, printError } from '../utils/output.js';
import { handleCommandError } from '../utils/errors.js';

export function registerClientCommands(program) {
  const client = program.command('client').description('Manage n8n client instances');

  client
    .command('add')
    .description('Add a new n8n client')
    .option('--name <name>', 'Client name (slug)')
    .option('--url <url>', 'n8n instance URL')
    .option('--key <key>', 'n8n API key')
    .action(async (opts) => {
      try {
        const name = opts.name ?? (await input({ message: 'Client name (slug):' }));
        const url = opts.url ?? (await input({ message: 'n8n URL (e.g. https://n8n.example.com):' }));
        const apiKey = opts.key ?? (await input({ message: 'API Key:' }));

        const spinner = ora('Testing connectivity...').start();
        try {
          await apiRequest({ url, apiKey }, 'GET', '/workflows', { params: { limit: 1 } });
          spinner.succeed('Connection successful');
        } catch (err) {
          spinner.fail(`Connection failed: ${err.message}`);
          return;
        }

        addClient({ name, url, apiKey, addedAt: new Date().toISOString() });
        printSuccess(`Client "${name}" added.`);
      } catch (err) {
        handleCommandError(err);
      }
    });

  client
    .command('list')
    .description('List all configured clients')
    .action(() => {
      try {
        const { clients } = loadConfig();
        if (clients.length === 0) {
          console.log('No clients configured. Run: n8n-manager client add');
          return;
        }
        printTable(
          ['Name', 'URL', 'Added'],
          clients.map(c => [c.name, c.url, c.addedAt ? c.addedAt.slice(0, 10) : '—'])
        );
      } catch (err) {
        handleCommandError(err);
      }
    });

  client
    .command('remove')
    .description('Remove a client')
    .option('--name <name>', 'Client name')
    .action(async (opts) => {
      try {
        const { clients } = loadConfig();
        if (clients.length === 0) {
          printError('No clients configured.');
          return;
        }

        let name = opts.name;
        if (!name) {
          const { select } = await import('@inquirer/prompts');
          name = await select({
            message: 'Select client to remove:',
            choices: clients.map(c => ({ name: c.name, value: c.name })),
          });
        }

        removeClient(name);
        printSuccess(`Client "${name}" removed.`);
      } catch (err) {
        handleCommandError(err);
      }
    });
}
