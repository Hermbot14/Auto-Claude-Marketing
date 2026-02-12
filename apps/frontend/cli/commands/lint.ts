/**
 * Lint Commands
 *
 * CLI commands for code quality checks
 */

import { Command } from 'commander'
import { spawnProcess } from '../lib/process'
import { logger } from '../lib/logger'

export const lintCommand = new Command('lint')
  .description('Run code quality checks')

lintCommand
  .command('all')
  .description('Run all linting and formatting')
  .option('--fix', 'Auto-fix issues')
  .action(async (options) => {
    const lintArgs = options.fix ? ['run', 'lint:fix'] : ['run', 'lint']

    logger.info('Running linter...')

    try {
      await spawnProcess({
        command: 'bun',
        args: lintArgs
      })
    } catch (error) {
      logger.error(`Lint failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })

lintCommand
  .command('check')
  .description('Run linter without fixes')
  .action(async () => {
    logger.info('Checking code quality...')

    try {
      await spawnProcess({
        command: 'bun',
        args: ['run', 'lint']
      })
    } catch (error) {
      logger.error(`Lint check failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })

lintCommand
  .command('fix')
  .description('Auto-fix linting issues')
  .action(async () => {
    logger.info('Fixing linting issues...')

    try {
      await spawnProcess({
        command: 'bun',
        args: ['run', 'lint:fix']
      })
    } catch (error) {
      logger.error(`Lint fix failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })

lintCommand
  .command('format')
  .description('Format code')
  .action(async () => {
    logger.info('Formatting code...')

    try {
      await spawnProcess({
        command: 'bun',
        args: ['run', 'format']
      })
    } catch (error) {
      logger.error(`Format failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })

lintCommand
  .command('typecheck')
  .description('Run TypeScript type checks')
  .action(async () => {
    logger.info('Running type checks...')

    try {
      await spawnProcess({
        command: 'bun',
        args: ['run', 'typecheck']
      })
    } catch (error) {
      logger.error(`Type check failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })

lintCommand
  .command('audit')
  .description('Run security audit')
  .action(async () => {
    logger.info('Running security audit...')
    logger.warning('This may take a few minutes...')

    try {
      await spawnProcess({
        command: 'bun',
        args: ['audit', '--production']
      })
    } catch (error) {
      logger.error(`Audit failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })
