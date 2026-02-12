/**
 * Settings Data Generator
 *
 * Generates realistic mock settings data for development
 */

export function generateSettings() {
  return {
    theme: Math.random() > 0.5 ? 'dark' : 'light',
    language: 'en',
    colorTheme: 'default',
    uiScale: 1.0,
    onboardingCompleted: true,
    autoBuildPath: '/path/to/auto-claude',
    ClaudeProfile: {
      defaultProfile: 'default',
      profiles: [
        {
          id: 'default',
          name: 'Claude (Default)',
          baseUrl: 'https://api.anthropic.com',
          isActive: true
        }
      ]
    },
    keyboardShortcuts: {
      'toggle-devtools': 'Cmd+Shift+D',
      'new-task': 'Cmd+T',
      'quick-open': 'Cmd+P'
    },
    terminal: {
      shell: process.platform === 'win32' ? 'powershell' : 'bash',
      fontSize: 14,
      fontFamily: 'SF Mono',
      cursorBlink: true,
      scrollback: 1000
    },
    github: {
      enabled: Math.random() > 0.5,
      tokenSet: Math.random() > 0.5,
      defaultBranch: 'main',
      authMethod: 'pat'
    },
    gitlab: {
      enabled: Math.random() > 0.7,
      tokenSet: Math.random() > 0.7,
      defaultBranch: 'main'
    },
    developerTools: {
      enabled: true,
      autoRefresh: true,
      refreshInterval: 1000
    }
  }
}
