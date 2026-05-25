type LogLevel = "debug" | "info" | "warn" | "error";

const logLevelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const configuredLevel = (process.env.LOG_LEVEL?.toLowerCase() ?? "info") as LogLevel;
const activeLevel: LogLevel = configuredLevel in logLevelRank ? configuredLevel : "info";

const redactKeys = new Set([
  "accessToken",
  "authorization",
  "cookie",
  "firebaseToken",
  "idToken",
  "loginOtp",
  "otp",
  "otpHash",
  "password",
  "passwordHash",
  "refreshToken",
  "token"
]);

const shouldLog = (level: LogLevel): boolean => logLevelRank[level] >= logLevelRank[activeLevel];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const redactSensitive = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      redactKeys.has(key.toLowerCase()) ? "[REDACTED]" : redactSensitive(entry)
    ])
  );
};

const serializeError = (error: unknown): unknown => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return error;
};

const writeLog = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? redactSensitive(meta) as Record<string, unknown> : {})
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
    return;
  }

  if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(line);
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => writeLog("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => writeLog("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => writeLog("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    writeLog("error", message, meta ? { ...meta, error: serializeError(meta.error) } : undefined)
};
