export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function useJsonFormat(): boolean {
  if (process.env.LOG_FORMAT === "json") return true;
  if (process.env.LOG_FORMAT === "pretty") return false;
  return process.env.NODE_ENV === "production";
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const extra: Record<string, unknown> = {};
    const record = error as unknown as Record<string, unknown>;
    if (typeof record._tag === "string") extra.tag = record._tag;
    if (typeof record.code === "string" || typeof record.code === "number") {
      extra.code = record.code;
    }
    if (typeof record.status === "number") extra.status = record.status;
    if (record.cause !== undefined) {
      extra.cause =
        record.cause instanceof Error
          ? { name: record.cause.name, message: record.cause.message }
          : String(record.cause);
    }
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...extra,
    };
  }
  return { message: String(error) };
}

function normalizeData(
  data?: Record<string, unknown>,
): Record<string, unknown> {
  if (!data) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    out[k] = v instanceof Error ? serializeError(v) : v;
  }
  return out;
}

export class Logger {
  constructor(
    private readonly scope: string,
    private readonly baseData: Record<string, unknown> = {},
  ) {}

  child(data: Record<string, unknown>): Logger {
    return new Logger(this.scope, { ...this.baseData, ...data });
  }

  private emit(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ) {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[resolveMinLevel()]) return;

    const ts = new Date().toISOString();
    const fields = normalizeData({ ...this.baseData, ...data });

    if (useJsonFormat()) {
      const line = JSON.stringify({
        ts,
        level,
        scope: this.scope,
        msg: message,
        ...fields,
      });
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
      return;
    }

    const prefix = `[${ts}] [${level.toUpperCase()}] [${this.scope}] ${message}`;
    const hasFields = Object.keys(fields).length > 0;
    if (level === "error") {
      if (hasFields) console.error(prefix, fields);
      else console.error(prefix);
    } else if (level === "warn") {
      if (hasFields) console.warn(prefix, fields);
      else console.warn(prefix);
    } else if (level === "debug") {
      if (hasFields) console.debug(prefix, fields);
      else console.debug(prefix);
    } else {
      if (hasFields) console.info(prefix, fields);
      else console.info(prefix);
    }
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.emit("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.emit("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.emit("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.emit("error", message, data);
  }
}

export function createLogger(
  scope: string,
  baseData?: Record<string, unknown>,
): Logger {
  return new Logger(scope, baseData);
}
