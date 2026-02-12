/**
 * Process spawning utilities for CLI
 *
 * Cross-platform process spawning with proper stdio handling
 */

import { spawn } from 'child_process'
import { logger } from './logger'
import { isWindows } from './platform'

export interface SpawnOptions {
  /** Working directory */
  cwd?: string
  /** Environment variables */
  env?: Record<string, string>
  /** Silent mode (no output) */
  silent?: boolean
  /** Command to run */
  command: string
  /** Arguments for command */
  args?: string[]
}

/**
 * Spawn a process with proper stdio handling
 */
export async function spawnProcess(options: SpawnOptions): Promise<number> {
  const {
    cwd = process.cwd(),
    env = {},
    silent = false,
    command,
    args = []
  } = options

  logger.debug(`Spawning: ${command} ${args.join(' ')}`)
  logger.info(`Running in: ${cwd}`)

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: isWindows(),
      stdio: silent ? 'ignore' : 'inherit'
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(code)
      } else if (code === null) {
        reject(new Error('Process was terminated by signal'))
      } else {
        reject(new Error(`Process exited with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      logger.error(`Process error: ${err.message}`)
      reject(err)
    })

    // Forward output if not silent
    if (!silent) {
      proc.stdout?.on('data', (data) => {
        process.stdout.write(data)
      })

      proc.stderr?.on('data', (data) => {
        process.stderr.write(data)
      })
    }
  })
}

/**
 * Run a command and get output
 */
export async function runCommand(options: SpawnOptions): Promise<string> {
  const { cwd = process.cwd(), command, args = [] } = options

  return new Promise((resolve, reject) => {
    let output = ''

    const proc = spawn(command, args, {
      cwd,
      shell: isWindows(),
      env: { ...process.env }
    })

    proc.stdout?.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      output += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim())
      } else {
        reject(new Error(`Command failed with code ${code}`))
      }
    })

    proc.on('error', reject)
  })
}
