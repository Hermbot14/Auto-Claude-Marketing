/**
 * Spec Management Commands
 *
 * CLI commands for Auto Claude spec operations
 */

import { Command } from 'commander'
import { spawnProcess } from '../lib/process'
import { logger } from '../lib/logger'

export const specCommand = new Command('spec')
  .description('Manage Auto Claude specs')

specCommand
  .command('list')
  .description('List all specs')
  .action(async () => {
    logger.info('Listing specs...')

    try {
      await spawnProcess({
        command: 'python',
        args: ['run.py', '--list'],
        cwd: 'apps/backend'
      })
    } catch (error) {
      logger.error(`Failed to list specs: ${(error as Error).message}`)
      process.exit(1)
    }
  })

specCommand
  .command('create')
  .description('Create new spec interactively')
  .option('-t, --task <task>', 'Task description')
  .option('-c, --complexity <level>', 'Complexity: simple, standard, complex')
  .action(async (options) => {
    const args = ['spec_runner.py', '--interactive']
    if (options.task) {
      args.push('--task', options.task)
    }
    if (options.complexity) {
      args.push('--complexity', options.complexity)
    }

    logger.info('Creating spec...')

    try {
      await spawnProcess({
        command: 'python',
        args,
        cwd: 'apps/backend'
      })
    } catch (error) {
      logger.error(`Failed to create spec: ${(error as Error).message}`)
      process.exit(1)
    }
  })

specCommand
  .command('run <spec>')
  .description('Run a spec')
  .argument('<spec>', 'Spec identifier or directory')
  .option('--review', 'Open review mode after completion')
  .option('--qa', 'Run QA after implementation')
  .action(async (spec, options) => {
    const args = ['run.py', '--spec', spec]
    if (options.review) {
      args.push('--review')
    }
    if (options.qa) {
      args.push('--qa')
    }

    logger.info(`Running spec ${spec}...`)

    try {
      await spawnProcess({
        command: 'python',
        args,
        cwd: 'apps/backend'
      })
    } catch (error) {
      logger.error(`Failed to run spec: ${(error as Error).message}`)
      process.exit(1)
    }
  })

specCommand
  .command('merge <spec>')
  .description('Merge spec to main branch')
  .argument('<spec>', 'Spec identifier')
  .option('--force', 'Force merge without confirmation')
  .action(async (spec, options) => {
    if (!options.force) {
      logger.warning(`About to merge spec ${spec} to main branch`)
      logger.warning('This will create a commit and may push changes')
      logger.info('Use --force to skip this warning')
    }

    const args = ['run.py', '--spec', spec, '--merge']

    logger.info(`Merging spec ${spec}...`)

    try {
      await spawnProcess({
        command: 'python',
        args,
        cwd: 'apps/backend'
      })
    } catch (error) {
      logger.error(`Failed to merge spec: ${(error as Error).message}`)
      process.exit(1)
    }
  })

specCommand
  .command('discard <spec>')
  .description('Discard spec changes')
  .argument('<spec>', 'Spec identifier')
  .action(async (spec) => {
    logger.info(`Discarding spec ${spec}...`)

    try {
      await spawnProcess({
        command: 'python',
        args: ['run.py', '--spec', spec, '--discard'],
        cwd: 'apps/backend'
      })
    } catch (error) {
      logger.error(`Failed to discard spec: ${(error as Error).message}`)
      process.exit(1)
    }
  })

specCommand
  .command('validate <spec>')
  .description('Validate spec')
  .argument('<spec>', 'Spec identifier')
  .option('--checkpoint', 'Checkpoint to validate', 'all')
  .action(async (spec, options) => {
    const args = ['validate_spec.py', '--spec-dir', `apps/backend/specs/${spec}`, '--checkpoint', options.checkpoint || 'all']

    logger.info(`Validating spec ${spec}...`)

    try {
      await spawnProcess({
        command: 'python',
        args,
        cwd: 'apps/backend'
      })
    } catch (error) {
      logger.error(`Failed to validate spec: ${(error as Error).message}`)
      process.exit(1)
    }
  })
