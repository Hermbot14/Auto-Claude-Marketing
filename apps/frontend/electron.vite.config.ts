import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { build } from 'vite';

/**
 * Sentry configuration embedded at build time.
 *
 * In CI builds, these come from GitHub secrets.
 * In local development, these come from apps/frontend/.env (loaded by dotenv).
 *
 * The `define` option replaces these values at build time, so they're
 * embedded in bundle and available at runtime in packaged apps.
 */
const sentryDefines = {
  '__SENTRY_DSN__': JSON.stringify(process.env.SENTRY_DSN || ''),
  '__SENTRY_TRACES_SAMPLE_RATE__': JSON.stringify(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  '__SENTRY_PROFILES_SAMPLE_RATE__': JSON.stringify(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
};

/**
 * Route-based code splitting configuration.
 *
 * This implements OPD-PERF-001 P1-1: Route-Based Code Splitting
 * Target: 40% reduction in initial bundle size
 */
const routeChunks = {
  // Core views - lazy loaded
  'view-kanban': ['./src/renderer/components/KanbanBoard.tsx'],
  'view-roadmap': ['./src/renderer/components/Roadmap.tsx'],
  'view-calendar': ['./src/renderer/components/calendar/index.tsx'],
  'view-context': ['./src/renderer/components/context/index.tsx'],
  'view-ideation': ['./src/renderer/components/Ideation.tsx'],
  'view-insights': ['./src/renderer/components/Insights.tsx'],
  'view-github-issues': ['./src/renderer/components/GitHubIssues.tsx'],
  'view-gitlab-issues': ['./src/renderer/components/GitLabIssues.tsx'],
  'view-github-prs': ['./src/renderer/components/github-prs/index.tsx'],
  'view-gitlab-mr': ['./src/renderer/components/gitlab-merge-requests/index.tsx'],
  'view-changelog': ['./src/renderer/components/changelog/index.tsx'],
  'view-worktrees': ['./src/renderer/components/Worktrees.tsx'],
  'view-agent-tools': ['./src/renderer/components/AgentTools.tsx'],
};

export default defineConfig({
  main: {
    define: sentryDefines,
    plugins: [externalizeDepsPlugin({
      // Bundle these packages into main process (they won't be in node_modules in packaged app)
      exclude: [
        'uuid',
        'chokidar',
        'dotenv',
        'electron-log',
        'proper-lockfile',
        'semver',
        'zod',
        '@anthropic-ai/sdk',
        'kuzu',
        'electron-updater',
        '@electron-toolkit/utils',
        // Sentry and its transitive dependencies (opentelemetry -> debug -> ms)
        '@sentry/electron',
        '@sentry/core',
        '@sentry/node',
        '@sentry/utils',
        '@opentelemetry/instrumentation',
        'debug',
        'ms'
      ]
    })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        },
        output: {
          format: 'cjs'
        },
        // Only node-pty needs to be external (native module rebuilt by electron-builder)
        external: ['@lydell/node-pty']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    define: sentryDefines,
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        },
        output: {
          // Manual chunk splitting for optimal caching and loading
          manualChunks(id) {
            // Node_modules packages
            if (id.includes('node_modules')) {
              // Vendor chunk for React core
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor-react';
              }
              // Vendor chunk for UI libraries
              if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('@dnd-kit')) {
                return 'vendor-ui';
              }
              // Vendor chunk for state management
              if (id.includes('zustand') || id.includes('immer')) {
                return 'vendor-state';
              }
              // Vendor chunk for utilities
              if (id.includes('date-fns') || id.includes('clsx') || id.includes('class-variance')) {
                return 'vendor-utils';
              }
              // Vendor chunk for terminal/xterm
              if (id.includes('@xterm') || id.includes('node-pty')) {
                return 'vendor-terminal';
              }
              // Vendor chunk for other libraries
              if (id.includes('node_modules')) {
                return 'vendor-other';
              }
            }

            // App-specific chunks
            for (const [chunkName, chunkPaths] of Object.entries(routeChunks)) {
              if (chunkPaths.some((path) => id.includes(path.replace('./src/renderer/', '')))) {
                return chunkName;
              }
            }

            // Default chunk for shared app code
            if (id.includes('src/renderer')) {
              return 'app-shared';
            }
          }
        }
      }
    },
    plugins: [
      react(),
      // Service worker plugin for caching
      {
        name: 'vite-plugin-service-worker',
        // Generate service worker with version hash
        generateSW: () => build({
          entry: resolve(__dirname, 'src/renderer/service-worker.ts'),
          name: 'service-worker.js',
          rollupOptions: {
            output: {
              entryFileNames: '[name]-[hash].js',
            },
          },
        }),
        // Register service worker in development
        devOptions: {
          type: 'module',
          registerSW: true,
        },
        // Configure workbox for production caching
        workbox: {
          globPatterns: [
            '**/*.{js,css,html}',
          ],
          globIgnores: [
            'node_modules/**',
            'assets/icons/**',
            '**/*.map',
          ],
          // Maximum cache size: 50 MB
          maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
          // Runtime cache strategy
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: 365 * 24 * 60 * 60 * 1000, // 1 year
                cacheableResponse: {
                  statuses: [0, 200],
                  headers: {
                    names: ['Content-Type'],
                    values: ['font/woff2'],
                  },
                },
              },
            },
          ],
          // Static asset caching
          staticAssetGlobs: [
            '/assets/**',
            '/fonts/**',
          ],
          // Precache critical routes
          navigateFallback: null,
          navigateFallbackAllowlist: [/^\/api/],
        },
      },
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
        '@features': resolve(__dirname, 'src/renderer/features'),
        '@components': resolve(__dirname, 'src/renderer/shared/components'),
        '@hooks': resolve(__dirname, 'src/renderer/shared/hooks'),
        '@lib': resolve(__dirname, 'src/renderer/shared/lib')
      }
    },
    server: {
      watch: {
        // Ignore directories to prevent HMR conflicts during merge operations
        // Using absolute paths and broader patterns
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.worktrees/**',
          '**/.auto-claude/**',
          '**/out/**',
          // Ignore parent autonomous-coding directory's worktrees
          resolve(__dirname, '../.worktrees/**'),
          resolve(__dirname, '../.auto-claude/**'),
        ]
      }
    }
  }
});
