/**
 * Documentation Development Server
 *
 * This script starts both VitePress and Storybook concurrently
 * for comprehensive documentation development.
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const docsDir = join(rootDir, 'docs')

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function startVitePress(): Promise<void> {
  return new Promise((resolve, reject) => {
    log('\n📚 Starting VitePress documentation server...', colors.cyan)

    const vitepress = spawn('bun', ['run', '--filter', 'docs', 'docs:dev'], {
      cwd: rootDir,
      stdio: 'pipe',
      shell: true
    })

    vitepress.stdout.on('data', (data) => {
      const output = data.toString()
      if (output.includes('VitePress')) {
        const match = output.match(/Local:\s+(http:\/\/localhost:\d+)/)
        if (match) {
          log(`✅ VitePress running at ${match[1]}`, colors.green)
        }
      }
      process.stdout.write(`[VitePress] ${output}`)
    })

    vitepress.stderr.on('data', (data) => {
      process.stderr.write(`[VitePress Error] ${data}`)
    })

    vitepress.on('error', (error) => {
      log(`❌ VitePress error: ${error.message}`, colors.red)
      reject(error)
    })

    vitepress.on('exit', (code) => {
      if (code !== 0) {
        log(`VitePress exited with code ${code}`, colors.yellow)
      }
    })

    // Keep reference for cleanup
    ;(global as any).vitepressProcess = vitepress
  })
}

function startStorybook(): Promise<void> {
  return new Promise((resolve, reject) => {
    log('📖 Starting Storybook server...', colors.magenta)

    const storybook = spawn('bun', ['run', '--filter', 'docs', 'storybook'], {
      cwd: rootDir,
      stdio: 'pipe',
      shell: true
    })

    storybook.stdout.on('data', (data) => {
      const output = data.toString()
      if (output.includes('storybook')) {
        const match = output.match(/Local:\s+(http:\/\/localhost:\d+)/)
        if (match) {
          log(`✅ Storybook running at ${match[1]}`, colors.green)
        }
      }
      process.stdout.write(`[Storybook] ${output}`)
    })

    storybook.stderr.on('data', (data) => {
      process.stderr.write(`[Storybook Error] ${data}`)
    })

    storybook.on('error', (error) => {
      log(`❌ Storybook error: ${error.message}`, colors.red)
      reject(error)
    })

    storybook.on('exit', (code) => {
      if (code !== 0) {
        log(`Storybook exited with code ${code}`, colors.yellow)
      }
    })

    // Keep reference for cleanup
    ;(global as any).storybookProcess = storybook
  })
}

async function startServers() {
  log('\n🚀 Auto Claude Marketing Hub - Documentation Development Server', colors.blue)
  log('═════════════════════════════════════════════════════════════\n', colors.blue)

  try {
    // Start both servers concurrently
    await Promise.all([
      startVitePress(),
      startStorybook()
    ])

    log('\n✨ All documentation servers are running!', colors.green)
    log('\n📚 Documentation: http://localhost:5173', colors.cyan)
    log('📖 Storybook:    http://localhost:6006', colors.magenta)
    log('🔌 API Explorer: http://localhost:5173/api-explorer/', colors.yellow)
    log('\nPress Ctrl+C to stop all servers\n', colors.reset)

  } catch (error) {
    log(`\n❌ Error starting servers: ${error}`, colors.red)
    process.exit(1)
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  log('\n\n🛑 Stopping documentation servers...', colors.yellow)

  const vitepress = (global as any).vitepressProcess
  const storybook = (global as any).storybookProcess

  if (vitepress) {
    vitepress.kill()
  }

  if (storybook) {
    storybook.kill()
  }

  log('✅ All servers stopped', colors.green)
  process.exit(0)
})

process.on('SIGTERM', () => {
  process.emit('SIGINT') as (...args: any[]) => void args[0]
})

// Start servers
startServers().catch((error) => {
  log(`\n❌ Fatal error: ${error}`, colors.red)
  process.exit(1)
})
