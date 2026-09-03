const isDev = import.meta.env.DEV

export const logger = {
  info: (...args) => isDev && console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => isDev && console.warn('[WARN]', ...args),
  debug: (...args) => isDev && console.log('[DEBUG]', ...args),
}
