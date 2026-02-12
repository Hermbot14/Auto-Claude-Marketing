/**
 * Platform detection utilities
 *
 * Cross-platform helpers for CLI operations
 */

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  return process.platform === 'win32'
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return process.platform === 'darwin'
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
  return process.platform === 'linux'
}

/**
 * Get path delimiter for current platform
 */
export function getPathDelimiter(): string {
  return isWindows() ? ';' : ':'
}

/**
 * Get executable extension for current platform
 */
export function getExecutableExtension(): string {
  return isWindows() ? '.exe' : ''
}

/**
 * Get binary directories for current platform
 */
export function getBinaryDirectories(): string[] {
  if (isWindows()) {
    return [
      'C:\\Program Files\\nodejs',
      'C:\\Program Files (x86)\\nodejs',
      process.env.APPDATA + '\\npm'
    ].filter(Boolean)
  }

  if (isMacOS()) {
    return [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      process.env.HOME + '/.npm-global/bin'
    ].filter(Boolean)
  }

  // Linux and others
  return [
    '/usr/local/bin',
    '/usr/bin',
    process.env.HOME + '/.local/bin',
    process.env.HOME + '/.npm-global/bin'
  ].filter(Boolean)
}

/**
 * Check if command requires shell on Windows
 */
export function requiresShell(command: string): boolean {
  return isWindows() && command.endsWith('.cmd')
}
