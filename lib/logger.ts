// Minimal structured logger — single-line JSON to stdout/stderr, the format
// every log aggregator (CloudWatch, Datadog, Loki, etc.) expects without
// extra parsing config. No dependency added deliberately: this sandbox's
// npm registry has a documented history of flaky/slow installs, and a
// leveled JSON logger is a small enough surface to hand-roll correctly.
type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function write(level: LogLevel, message: string, context?: LogContext) {
  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  });
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    write("debug", message, context),
  info: (message: string, context?: LogContext) =>
    write("info", message, context),
  warn: (message: string, context?: LogContext) =>
    write("warn", message, context),
  error: (message: string, context?: LogContext) =>
    write("error", message, context),
};
