#!/usr/bin/env node
/**
 * Auto-Claude-Marketing CLI Toolbelt
 *
 * Unified CLI for all development operations.
 * Provides a single interface for:
 * - Development server commands
 * - Build commands
 * - Test commands
 * - Code quality commands
 * - Spec management
 * - Component generation
 *
 * Usage: acm [command] [options]
 */

import { Command } from 'commander'
import { spawnProcess } from './lib/process'
import { logger } from './lib/logger'
import { devCommand } from './commands/dev'
import { buildCommand } from './commands/build'
import { testCommand } from './commands/test'
import { lintCommand } from './commands/lint'
import { specCommand } from './commands/spec'

const program = new Command()

program
  .name('acm')
  .description('Auto-Claude-Marketing CLI Toolbelt')
  .version('1.0.0')

// Register all commands
program.addCommand(devCommand)
program.addCommand(buildCommand)
program.addCommand(testCommand)
program.addCommand(lintCommand)
program.addCommand(specCommand)

// Parse and execute
program.parse()

export { program }
