const isDev = __DEV__;

export const logger = {
  log: (...args: any[]) => { if (isDev) console.log(...args); },
  warn: (...args: any[]) => { if (isDev) console.warn(...args); },
  error: (...args: any[]) => console.error(...args),  // always keep errors
};

// Replace console.log(...) with logger.log(...)
// Keep console.error for production crash tracking