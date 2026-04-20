#!/usr/bin/env node

import { Command } from 'commander';
import { registerClientCommands } from '../src/commands/client.js';
import { registerWorkflowCommands } from '../src/commands/workflow.js';
import { registerExecutionCommands } from '../src/commands/execution.js';

const program = new Command();

program
  .name('n8n-manager')
  .description('CLI to manage multiple n8n instances across clients')
  .version('1.0.0');

registerClientCommands(program);
registerWorkflowCommands(program);
registerExecutionCommands(program);

// Comando telegram
const telegram = program.command('telegram').description('Bot de Telegram con agente Claude');

telegram
  .command('setup')
  .description('Configura el token del bot de Telegram')
  .action(async () => {
    const { input } = await import('@inquirer/prompts');
    const { loadTelegramConfig, saveTelegramConfig } = await import('../src/telegram/config.js');
    const chalk = (await import('chalk')).default;

    const current = loadTelegramConfig();

    console.log(chalk.cyan('\nConfiguración del Bot de Telegram\n'));
    console.log('Necesitás el token que te da @BotFather en Telegram.\n');

    const telegramToken = await input({
      message: 'Token de Telegram:',
      default: current.telegramToken || '',
    });

    saveTelegramConfig({ telegramToken });
    console.log(chalk.green('\nToken guardado en telegram.json'));
    console.log(chalk.cyan('Iniciá el bot con: n8n-manager telegram start'));
  });

telegram
  .command('start')
  .description('Inicia el bot de Telegram')
  .action(async () => {
    const { startBot } = await import('../src/telegram/bot.js');
    startBot();
  });

telegram
  .command('status')
  .description('Muestra el estado de la configuración del bot')
  .action(async () => {
    const { loadTelegramConfig } = await import('../src/telegram/config.js');
    const chalk = (await import('chalk')).default;
    const config = loadTelegramConfig();

    console.log(chalk.cyan('\nEstado del Bot de Telegram:'));
    if (config.telegramToken) {
      const masked = config.telegramToken.slice(0, 8) + '...' + config.telegramToken.slice(-4);
      console.log(chalk.green(`✓ Token: ${masked}`));
    } else {
      console.log(chalk.red('✗ Token: no configurado (ejecutá: n8n-manager telegram setup)'));
    }
    console.log();
  });

program
  .command('dashboard')
  .description('Abre el dashboard web para gestionar clientes y workflows')
  .option('-p, --port <number>', 'Puerto del servidor', '3456')
  .option('--no-open', 'No abrir el navegador automáticamente')
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const { startServer } = await import('../src/server/index.js');
    await startServer(port, opts.open);
  });

program.parse(process.argv);
