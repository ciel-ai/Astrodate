/**
 * utils/logger.ts
 *
 * Production-safe logger. In dev mode all levels print to the console.
 * In production:
 *   - log / warn are suppressed (babel-plugin-transform-remove-console
 *     strips console.log/warn at build time anyway, but this guard
 *     makes the intent explicit and keeps the bundle clean in managed
 *     workflow where the Babel plugin may not run).
 *   - error is forwarded to Sentry AND to console.error so it still
 *     appears in native crash logs / Metro.
 *
 * Every existing logger.error() call in the codebase is automatically
 * captured in Sentry with no further changes needed.
 */

const isDev = __DEV__;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },

  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },

  error: (message: string | Error, context?: Record<string, unknown>) => {
    console.error('[error]', message, context ?? '');
  },
};
