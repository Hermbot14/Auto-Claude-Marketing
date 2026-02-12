/**
 * Development Commands
 *
 * CLI commands for starting development servers
 */

import { Command } from 'commander'
import { spawnProcess } from '../lib/process'
import { logger } from '../lib/logger'

export const devCommand = new Command('dev')
  .description('Start development server')

devCommand
  .command('web')
  .description('Start web development server')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('--mock', 'Use mock server')
  .option('--verbose', 'Verbose output')
  .action(async (options) => {
    const args = ['run', 'dev:' + (options.mock ? 'mock' : 'web')]
    if (options.port) {
      process.env.PORT = options.port
    }
    if (options.verbose) {
      process.env.VERBOSE = '1'
    }
    if (options.mock) {
      process.env.VITE_USE_MOCK_SERVER = 'true'
    }

    logger.info('Starting web development server...')
    if (options.mock) {
      logger.warning('Mock mode enabled - using MSW for API mocking')
    }

    try {
      await spawnProcess({
        command: 'bun',
        args
      })
    } catch (error) {
      logger.error(`Failed to start dev server: ${(error as Error).message}`)
      process.exit(1)
    }
  })

devCommand
  .command('electron')
  .description('Start Electron development')
  .option('--debug', 'Enable debug mode')
  .option('--mcp', 'Enable MCP server (port 9222)')
  .option('--verbose', 'Verbose output')
  .action(async (options) => {
    const args = options.debug
      ? ['run', 'dev:debug']
      : options.mcp
        ? ['run', 'dev:mcp']
        : ['run', 'dev']

    if (options.verbose) {
      process.env.VERBOSE = '1'
    }

    logger.info('Starting Electron development...')
    if (options.debug) {
      logger.info('Debug mode enabled')
    }
    if (options.mcp) {
      logger.info('MCP server enabled on port 9222')
    }

    try {
      await spawnProcess({
        command: 'bun',
        args
      })
    } catch (error) {
      logger.error(`Failed to start Electron: ${(error as Error).message}`)
      process.exit(1)
    }
  })

devCommand
  .command('backend')
  .description('Start backend server (requires Python)')
  .option('--port <port>', 'Backend port', '8000')
  .action(async (options) => {
    if (options.port) {
      process.env.PORT = options.port
    }

    logger.info('Starting backend server...')
    logger.warning('Backend requires Python 3.12+ and virtual environment')

    try {
      await spawnProcess({
        command: 'python',
        args: ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', options.port || '8000'],
        cwd: 'apps/backend'
      })
    } catch (error) {
      logger.error(`Failed to start backend: ${(error as Error).message}`)
      logger.info('Make sure Python 3.12+ is installed and venv is activated')
      process.exit(1)
    }
  })
