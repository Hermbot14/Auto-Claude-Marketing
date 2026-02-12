/**
 * Test Commands
 *
 * CLI commands for running tests
 */

import { Command } from 'commander'
import { spawnProcess } from '../lib/process'
import { logger } from '../lib/logger'

export const testCommand = new Command('test')
  .description('Run tests')

testCommand
  .command('all')
  .description('Run all tests')
  .option('--coverage', 'Generate coverage report')
  .option('--watch', 'Watch mode')
  .action(async (options) => {
    const args = options.watch ? ['run', 'test:watch'] : ['run', 'test']
    if (options.coverage && !options.watch) {
      args.push('--coverage')
    }

    logger.info('Running all tests...')

    try {
      await spawnProcess({
        command: 'bun',
        args
      })
    } catch (error) {
      logger.error(`Tests failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })

testCommand
  .command('unit')
  .description('Run unit tests')
  .option('--watch', 'Watch mode')
  .option('--coverage', 'Generate coverage')
  .action(async (options) => {
    const args = options.watch
      ? ['run', 'test:watch']
      : ['run', 'test']

    if (options.coverage && !options.watch) {
      logger.info('Coverage will be generated')
    }

    logger.info('Running unit tests...')

    try {
      await spawnProcess({
        command: 'bun',
        args
      })
    } catch (error) {
      logger.error(`Unit tests failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })

testCommand
  .command('e2e')
  .description('Run E2E tests')
  .option('--headed', 'Show browser')
  .option('--web', 'Test web version instead of Electron')
  .action(async (options) => {
    const args = options.web
      ? ['run', 'test:e2e:web']
      : ['run', 'test:e2e']

    if (options.headed) {
      args.push('--headed')
      logger.info('Running in headed mode (browser visible)')
    } else {
      logger.info('Running in headless mode')
    }

    logger.info('Running E2E tests...')

    try {
      await spawnProcess({
        command: 'bun',
        args
      })
    } catch (error) {
      logger.error(`E2E tests failed: ${(error as Error).message}`)
      logger.info('Make sure Playwright browsers are installed: bun run playwright:install')
      process.exit(1)
    }
  })

testCommand
  .command('coverage')
  .description('Generate coverage report')
  .action(async () => {
    logger.info('Generating coverage report...')

    try {
      await spawnProcess({
        command: 'bun',
        args: ['run', 'test:coverage']
      })
    } catch (error) {
      logger.error(`Coverage generation failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })
