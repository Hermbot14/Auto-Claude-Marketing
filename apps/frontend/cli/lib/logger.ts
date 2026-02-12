/**
 * CLI Logger
 *
 * Colored console output for the CLI toolbelt
 */

import chalk from 'chalk'

export const logger = {
  /**
   * Info message (blue)
   */
  info: (msg: string) => {
    console.log(chalk.blue('ℹ'), msg)
  },

  /**
   * Success message (green)
   */
  success: (msg: string) => {
    console.log(chalk.green('✓'), msg)
  },

  /**
   * Warning message (yellow)
   */
  warning: (msg: string) => {
    console.log(chalk.yellow('⚠'), msg)
  },

  /**
   * Error message (red)
   */
  error: (msg: string) => {
    console.error(chalk.red('✗'), msg)
  },

  /**
   * Debug message (gray, only when DEBUG=1)
   */
  debug: (msg: string) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🐛'), msg)
    }
  },

  /**
   * Verbose message (cyan)
   */
  verbose: (msg: string) => {
    if (process.env.VERBOSE || process.env.DEBUG) {
      console.log(chalk.cyan('→'), msg)
    }
  }
}
