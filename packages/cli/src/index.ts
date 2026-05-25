#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

const program = new Command();

program
  .name('selfcure')
  .description('AI-powered self-healing Playwright test CLI')
  .version('0.1.0');

program
  .command('init')
  .description('Scaffold selfcure.config.js in the current project')
  .action(async () => {
    const spinner = ora('Initialising selfcure…').start();
    try {
      // TODO: copy selfcure.config.js template into cwd
      spinner.succeed(chalk.green('selfcure.config.js created'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('crawl')
  .description('Crawl source files and extract component metadata')
  .option('-c, --config <path>', 'path to selfcure.config.js', './selfcure.config.js')
  .action(async (_opts) => {
    const spinner = ora('Crawling source files…').start();
    try {
      // TODO: load config, call @selfcure/crawler, print summary
      spinner.succeed(chalk.green('Crawl complete'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Generate tests, run them, and self-heal failures automatically')
  .option('-c, --config <path>', 'path to selfcure.config.js', './selfcure.config.js')
  .action(async (_opts) => {
    const spinner = ora('Running selfcure pipeline…').start();
    try {
      // TODO: crawl → analyze → generate → run → heal → report
      spinner.succeed(chalk.green('Pipeline complete'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('heal')
  .description('Attempt to heal failing tests without re-generating the full suite')
  .option('-c, --config <path>', 'path to selfcure.config.js', './selfcure.config.js')
  .action(async (_opts) => {
    const spinner = ora('Healing failing tests…').start();
    try {
      // TODO: load last run results, call @selfcure/selfcure healer
      spinner.succeed(chalk.green('Healing complete'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate HTML report from the last run results')
  .option('-c, --config <path>', 'path to selfcure.config.js', './selfcure.config.js')
  .action(async (_opts) => {
    const spinner = ora('Generating report…').start();
    try {
      // TODO: call @selfcure/reporter with persisted run/heal results
      spinner.succeed(chalk.green('Report generated'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program.parse();
