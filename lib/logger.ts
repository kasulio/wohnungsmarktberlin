/**
 * Log levels
 */
enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * Structured logger for consistent logging
 */
export class Logger {
  constructor(private context: string) {}

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level.toUpperCase()}] [${
      this.context
    }] ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted, data || "");
        break;
      case LogLevel.INFO:
        console.info(formatted, data || "");
        break;
      case LogLevel.WARN:
        console.warn(formatted, data || "");
        break;
      case LogLevel.ERROR:
        console.error(formatted, data || "");
        break;
    }
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, data);
  }
}

/**
 * Creates a logger instance for a given context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}
