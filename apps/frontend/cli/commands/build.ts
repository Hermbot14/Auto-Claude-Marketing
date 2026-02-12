/**
 * Build Commands
 *
 * CLI commands for building the application
 */

import { Command } from 'commander'
import { spawnProcess } from '../lib/process'
import { logger } from '../lib/logger'
import { isWindows } from '../lib/platform'

export const buildCommand = new Command('build')
  .description('Build the application')

buildCommand
  .command('all')
  .description('Build for current platform')
  .option('--output <dir>', 'Output directory', 'dist')
  .action(async (options) => {
    logger.info('Building for current platform...')

    try {
      await spawnProcess({
        command: 'bun',
        args: ['run', 'build']
      })
    } catch (error) {
      logger.error(`Build failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })

buildCommand
  .command('web')
  .description('Build web version only')
  .option('--analyze', 'Analyze bundle size')
  .action(async (options) => {
    logger.info('Building web version...')

    const args = ['run', 'preview']
    if (options.analyze) {
      process.env.VITE_ANALYZE = 'true'
      logger.info('Bundle analysis enabled')
    }

    try {
      await spawnProcess({
        command: 'bun',
        args
      })
    } catch (error) {
      logger.error(`Build failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })

buildCommand
  .command('electron')
  .description('Build Electron app')
  .option('--dir <dir>', 'Build directory', 'out')
  .action(async (options) => {
    logger.info('Building Electron app...')

    try {
      await spawnProcess({
        command: 'bun',
        args: ['run', 'build']
      })
    } catch (error) {
      logger.error(`Build failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })
