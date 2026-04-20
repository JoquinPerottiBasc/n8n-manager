import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../config/store.js';
import { apiRequest } from '../api/client.js';
import { printTable, printJson, printInfo } from '../utils/output.js';
import { selectClient } from '../utils/prompt.js';
import { handleCommandError } from '../utils/errors.js';

export function registerExecutionCommands(program) {
  const exec = program.command('execution').description('Monitor n8n executions');

  exec
    .command('list')
    .description('List executions for a client')
    .option('--client <name>', 'Client name')
    .option('--workflow <id>', 'Filter by workflow ID')
    .option('--status <status>', 'Filter by status (error, success, waiting, running)')
    .option('--limit <n>', 'Max results', '20')
    .action(async (opts) => {
      try {
        const clientName = opts.client ?? (await selectClient());
        const client = getClient(clientName);

        const params = { limit: parseInt(opts.limit, 10) };
        if (opts.workflow) params.workflowId = opts.workflow;
        if (opts.status) params.status = opts.status;

        const spinner = ora('Fetching executions...').start();
        const [data, wfData] = await Promise.all([
          apiRequest(client, 'GET', '/executions', { params }),
          apiRequest(client, 'GET', '/workflows', { params: { limit: 250 } }).catch(() => ({ data: [] })),
        ]);
        spinner.stop();

        const executions = Array.isArray(data) ? data : (data.data ?? []);
        const workflows = Array.isArray(wfData) ? wfData : (wfData.data ?? []);
        const wfNames = Object.fromEntries(workflows.map(w => [w.id, w.name]));

        if (executions.length === 0) {
          printInfo('No executions found.');
          return;
        }

        printTable(
          ['ID', 'Workflow', 'Status', 'Mode', 'Started', 'Duration'],
          executions.map(e => {
            const started = e.startedAt ? e.startedAt.slice(0, 19).replace('T', ' ') : '—';
            const duration =
              e.startedAt && e.stoppedAt
                ? `${((new Date(e.stoppedAt) - new Date(e.startedAt)) / 1000).toFixed(1)}s`
                : '—';
            const statusVal = e.status ?? (e.finished ? 'success' : 'running');
            const status =
              statusVal === 'error'
                ? chalk.red('error')
                : statusVal === 'success'
                ? chalk.green('success')
                : chalk.yellow(statusVal);
            const wfName = wfNames[e.workflowId] ?? e.workflowId ?? '—';
            return [e.id, wfName, status, e.mode ?? '—', started, duration];
          })
        );
      } catch (err) {
        handleCommandError(err);
      }
    });

  exec
    .command('get')
    .description('Get execution details as JSON')
    .requiredOption('--client <name>', 'Client name')
    .requiredOption('--id <id>', 'Execution ID')
    .action(async (opts) => {
      try {
        const client = getClient(opts.client);
        const spinner = ora('Fetching execution...').start();
        const data = await apiRequest(client, 'GET', `/executions/${opts.id}`, {
          params: { includeData: true },
        });
        spinner.stop();
        process.stdout.write(JSON.stringify(data, null, 2) + '\n');
      } catch (err) {
        handleCommandError(err);
      }
    });

  exec
    .command('errors')
    .description('Show which nodes failed in an execution')
    .requiredOption('--client <name>', 'Client name')
    .requiredOption('--id <id>', 'Execution ID')
    .action(async (opts) => {
      try {
        const client = getClient(opts.client);
        const spinner = ora('Fetching execution data...').start();
        const data = await apiRequest(client, 'GET', `/executions/${opts.id}`, {
          params: { includeData: true },
        });
        spinner.stop();

        console.log(chalk.bold(`\nExecution ${opts.id}`));
        console.log(`Status: ${data.status === 'error' ? chalk.red(data.status) : chalk.green(data.status)}`);
        if (data.startedAt) {
          console.log(`Started: ${data.startedAt.replace('T', ' ').slice(0, 19)}`);
        }

        const runData = data.data?.resultData?.runData ?? {};

        if (Object.keys(runData).length === 0) {
          printInfo('No node run data available.');
          return;
        }

        console.log(chalk.bold('\nNode Results:'));
        const errorNodes = [];

        for (const [nodeName, runs] of Object.entries(runData)) {
          for (const run of runs) {
            if (run.error) {
              errorNodes.push({ nodeName, error: run.error });
            }
          }
        }

        if (errorNodes.length === 0) {
          console.log(chalk.green('No node errors found.'));
        } else {
          for (const { nodeName, error } of errorNodes) {
            console.log(`\n${chalk.red('✗')} Node: ${chalk.bold(nodeName)}`);
            console.log(`  Message: ${error.message ?? 'Unknown error'}`);
            if (error.description) console.log(`  Description: ${error.description}`);
            if (error.context) console.log(`  Context: ${JSON.stringify(error.context)}`);
            if (error.stack) {
              const lines = error.stack.split('\n').slice(0, 3).join('\n  ');
              console.log(`  Stack:\n  ${chalk.grey(lines)}`);
            }
          }
        }

        // Show all nodes with their status summary
        console.log(chalk.bold('\nAll Nodes:'));
        printTable(
          ['Node', 'Runs', 'Errors'],
          Object.entries(runData).map(([name, runs]) => {
            const errors = runs.filter(r => r.error).length;
            return [
              name,
              runs.length,
              errors > 0 ? chalk.red(String(errors)) : chalk.green('0'),
            ];
          })
        );
      } catch (err) {
        handleCommandError(err);
      }
    });
}
