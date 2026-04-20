import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import ora from 'ora';
import { getClient } from '../config/store.js';
import { apiRequest, fetchAllPages } from '../api/client.js';
import { printTable, printJson, printSuccess, printError, printInfo } from '../utils/output.js';
import { selectClient, selectWorkflow } from '../utils/prompt.js';
import { handleCommandError } from '../utils/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLANK_TEMPLATE = join(__dirname, '../../templates/blank-workflow.json');

function stripReadonlyFields(wf) {
  const { id, active, createdAt, updatedAt, versionId,
          isArchived, activeVersionId, versionCounter, triggerCount,
          shared, activeVersion, ...rest } = wf;
  // binaryMode y callerPolicy no son aceptados por la API en settings
  if (rest.settings) {
    const { binaryMode, callerPolicy, ...cleanSettings } = rest.settings;
    rest.settings = cleanSettings;
  }
  // tags, meta, pinData, description pueden causar error 400 en algunos n8n
  const { tags, meta, pinData, description, ...clean } = rest;
  return clean;
}

export function registerWorkflowCommands(program) {
  const wf = program.command('workflow').description('Manage n8n workflows');

  wf
    .command('list')
    .description('List workflows for a client')
    .option('--client <name>', 'Client name')
    .option('--active', 'Show only active workflows')
    .option('--search <text>', 'Filter by name')
    .action(async (opts) => {
      try {
        const clientName = opts.client ?? (await selectClient());
        const client = getClient(clientName);

        const spinner = ora('Fetching workflows...').start();
        let workflows = await fetchAllPages(client, '/workflows');
        spinner.stop();

        if (opts.active) workflows = workflows.filter(w => w.active);
        if (opts.search) {
          const q = opts.search.toLowerCase();
          workflows = workflows.filter(w => w.name.toLowerCase().includes(q));
        }

        if (workflows.length === 0) {
          printInfo('No workflows found.');
          return;
        }

        printTable(
          ['ID', 'Name', 'Active', 'Updated'],
          workflows.map(w => [
            w.id,
            w.name,
            w.active ? '✓' : '—',
            w.updatedAt ? w.updatedAt.slice(0, 10) : '—',
          ])
        );
      } catch (err) {
        handleCommandError(err);
      }
    });

  wf
    .command('get')
    .description('Get a workflow as JSON (pipe-friendly)')
    .requiredOption('--client <name>', 'Client name')
    .option('--id <id>', 'Workflow ID')
    .action(async (opts) => {
      try {
        const client = getClient(opts.client);
        const id = opts.id ?? (await selectWorkflow(opts.client));
        const data = await apiRequest(client, 'GET', `/workflows/${id}`);
        // Print clean JSON to stdout for piping
        process.stdout.write(JSON.stringify(data, null, 2) + '\n');
      } catch (err) {
        handleCommandError(err);
      }
    });

  wf
    .command('create')
    .description('Create a workflow from a file or blank template')
    .option('--client <name>', 'Client name')
    .option('--file <path>', 'Path to workflow JSON file')
    .option('--template <type>', 'Use built-in template (blank)')
    .option('--name <name>', 'Workflow name (used with --template)')
    .action(async (opts) => {
      try {
        const clientName = opts.client ?? (await selectClient());
        const client = getClient(clientName);

        let body;
        if (opts.file) {
          const filePath = resolve(opts.file);
          if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
          body = JSON.parse(readFileSync(filePath, 'utf8'));
          body = stripReadonlyFields(body);
        } else if (opts.template === 'blank') {
          body = JSON.parse(readFileSync(BLANK_TEMPLATE, 'utf8'));
          if (opts.name) body.name = opts.name;
        } else {
          throw new Error('Provide --file <path> or --template blank');
        }

        const spinner = ora('Creating workflow...').start();
        const result = await apiRequest(client, 'POST', '/workflows', { data: body });
        spinner.stop();
        printSuccess(`Workflow created: [${result.id}] ${result.name}`);
      } catch (err) {
        handleCommandError(err);
      }
    });

  wf
    .command('update')
    .description('Update a workflow from a JSON file')
    .option('--client <name>', 'Client name')
    .requiredOption('--file <path>', 'Path to workflow JSON file')
    .option('--id <id>', 'Workflow ID (uses id from file if omitted)')
    .action(async (opts) => {
      try {
        const clientName = opts.client ?? (await selectClient());
        const client = getClient(clientName);

        const filePath = resolve(opts.file);
        if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        const raw = JSON.parse(readFileSync(filePath, 'utf8'));
        const id = opts.id ?? raw.id;
        if (!id) throw new Error('Provide --id or include "id" in the JSON file');

        const body = stripReadonlyFields(raw);

        const spinner = ora('Updating workflow...').start();
        const result = await apiRequest(client, 'PUT', `/workflows/${id}`, { data: body });
        spinner.stop();
        printSuccess(`Workflow updated: [${result.id}] ${result.name}`);
      } catch (err) {
        handleCommandError(err);
      }
    });

  wf
    .command('copy')
    .description('Copy a workflow from one client to another')
    .option('--from <client>', 'Source client name')
    .option('--to <client>', 'Destination client name')
    .option('--id <id>', 'Workflow ID to copy')
    .option('--name <name>', 'New workflow name (optional)')
    .action(async (opts) => {
      try {
        const fromName = opts.from ?? (await selectClient());
        const toName = opts.to ?? (await selectClient());
        const fromClient = getClient(fromName);
        const toClient = getClient(toName);

        const id = opts.id ?? (await selectWorkflow(fromName));

        const spinner = ora('Fetching source workflow...').start();
        const source = await apiRequest(fromClient, 'GET', `/workflows/${id}`);
        spinner.text = 'Creating copy...';

        const body = stripReadonlyFields(source);
        if (opts.name) body.name = opts.name;
        body.active = false;

        const result = await apiRequest(toClient, 'POST', '/workflows', { data: body });
        spinner.stop();
        printSuccess(`Copied to "${toName}": [${result.id}] ${result.name}`);
      } catch (err) {
        handleCommandError(err);
      }
    });

  wf
    .command('activate')
    .description('Activate a workflow')
    .option('--client <name>', 'Client name')
    .option('--id <id>', 'Workflow ID')
    .action(async (opts) => {
      try {
        const clientName = opts.client ?? (await selectClient());
        const client = getClient(clientName);
        const id = opts.id ?? (await selectWorkflow(clientName));

        const spinner = ora('Activating...').start();
        await apiRequest(client, 'POST', `/workflows/${id}/activate`);
        spinner.stop();
        printSuccess(`Workflow ${id} activated.`);
      } catch (err) {
        handleCommandError(err);
      }
    });

  wf
    .command('deactivate')
    .description('Deactivate a workflow')
    .option('--client <name>', 'Client name')
    .option('--id <id>', 'Workflow ID')
    .action(async (opts) => {
      try {
        const clientName = opts.client ?? (await selectClient());
        const client = getClient(clientName);
        const id = opts.id ?? (await selectWorkflow(clientName));

        const spinner = ora('Deactivating...').start();
        await apiRequest(client, 'POST', `/workflows/${id}/deactivate`);
        spinner.stop();
        printSuccess(`Workflow ${id} deactivated.`);
      } catch (err) {
        handleCommandError(err);
      }
    });

  wf
    .command('delete')
    .description('Delete a workflow')
    .option('--client <name>', 'Client name')
    .option('--id <id>', 'Workflow ID')
    .action(async (opts) => {
      try {
        const clientName = opts.client ?? (await selectClient());
        const client = getClient(clientName);
        const id = opts.id ?? (await selectWorkflow(clientName));

        const spinner = ora('Deleting...').start();
        await apiRequest(client, 'DELETE', `/workflows/${id}`);
        spinner.stop();
        printSuccess(`Workflow ${id} deleted.`);
      } catch (err) {
        handleCommandError(err);
      }
    });
}
