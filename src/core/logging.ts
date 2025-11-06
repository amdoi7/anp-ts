export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Defines the contract that all logger implementations must adhere to.
 */
export interface Logger {
  /**
   * Logs a single entry.
   * @param level The level of the log entry.
   * @param message The log message.
   * @param payload Optional structured data to include with the log entry.
   */
  log(level: LogLevel, message: string, payload?: Record<string, unknown>): void;
}

/**
 * The LogManager is the primary interface for logging in the SDK.
 * It manages log levels, context, and dispatches to a concrete Logger implementation.
 */
export class LogManager {
  /**
   * @param logger The underlying logger implementation. Defaults to ConsoleLogger.
   * @param level The minimum level to log. Defaults to 'info'.
   * @param context Persistent context for this LogManager instance.
   */
  constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly level: LogLevel = "info",
    private readonly context: Record<string, unknown> = {}
  ) {}

  /**
   * Creates a "child" logger with additional, persistent context.
   * This is key to contextual logging, e.g., creating a logger for a specific module or request.
   * @param newContext New data to add to the existing context.
   * @returns A new LogManager instance with the merged context.
   */
  withContext(newContext: Record<string, unknown>): LogManager {
    return new LogManager(this.logger, this.level, { ...this.context, ...newContext });
  }

  public debug(message: string, payload?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      this.logger.log("debug", message, this.mergeContext(payload));
    }
  }

  public info(message: string, payload?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      this.logger.log("info", message, this.mergeContext(payload));
    }
  }

  public warn(message: string, payload?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      this.logger.log("warn", message, this.mergeContext(payload));
    }
  }

  public error(message: string, error?: Error, payload?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      const errorPayload = {
        ...payload,
        error: error ? { message: error.message, stack: error.stack, name: error.name } : undefined,
      };
      this.logger.log("error", message, this.mergeContext(errorPayload));
    }
  }

  private mergeContext(payload?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.context, ...payload };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }
}

/**
 * A default logger that writes structured JSON to the console.
 */
export class ConsoleLogger implements Logger {
  log(level: LogLevel, message: string, payload?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    // Using console[level] is possible but JSON output is more consistent
    console.log(JSON.stringify({ timestamp, level, message, ...payload }));
  }
}

/**
 * A "null" logger that does nothing.
 * Useful for disabling logging completely or in tests.
 */
export class NullLogger implements Logger {
  log() { /* no-op */ }
}
