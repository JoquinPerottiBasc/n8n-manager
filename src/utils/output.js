import chalk from 'chalk';
import Table from 'cli-table3';

export function printTable(headers, rows) {
  const table = new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: { border: ['grey'] },
  });
  for (const row of rows) {
    table.push(row);
  }
  console.log(table.toString());
}

export function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function printSuccess(msg) {
  console.log(chalk.green('✓') + ' ' + msg);
}

export function printError(msg) {
  console.error(chalk.red('✗') + ' ' + msg);
}

export function printInfo(msg) {
  console.log(chalk.blue('ℹ') + ' ' + msg);
}

export function printWarning(msg) {
  console.log(chalk.yellow('⚠') + ' ' + msg);
}
