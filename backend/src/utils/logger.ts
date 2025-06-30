// TODO: Build out full logging system. Could use something like cloudwatch or a file based logging system
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
  },

  error: (message: string, error?: Error, meta?: any) => {
    console.error(
      `[ERROR] ${message}`,
      error?.message || '',
      meta ? JSON.stringify(meta) : ''
    );
    if (error?.stack) {
      console.error(error.stack);
    }
  },

  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
  },

  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
};
