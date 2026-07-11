import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimitBackend, rateLimitBucketCount } from "@/lib/auth/rate-limit";
import { isRedisConfigured } from "@/lib/redis";
import { isStorageConfigured } from "@/lib/storage";

// Hand-rolled Prometheus text exposition format — no client library added
// deliberately (this sandbox's npm registry has a documented history of
// flaky/slow installs, and the format itself is a handful of well-documented
// lines: "# HELP", "# TYPE", then "metric_name value"). Validate any new
// metric added here against https://prometheus.io/docs/instrumenting/exposition_formats/.
function metricLine(name: string, help: string, type: string, value: number) {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name} ${value}\n`;
}

export async function GET(request: Request) {
  if (env.METRICS_TOKEN) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${env.METRICS_TOKEN}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const mem = process.memoryUsage();

  let dbUp = 1;
  let userCount = 0;
  let organizationCount = 0;
  try {
    [userCount, organizationCount] = await Promise.all([
      db.user.count(),
      db.organization.count(),
    ]);
  } catch {
    dbUp = 0;
  }

  const lines = [
    metricLine(
      "uamsatech_up",
      "Whether the app process is serving requests.",
      "gauge",
      1
    ),
    metricLine(
      "uamsatech_process_uptime_seconds",
      "Seconds since the process started.",
      "gauge",
      process.uptime()
    ),
    metricLine(
      "uamsatech_nodejs_heap_used_bytes",
      "Node.js heap memory in use.",
      "gauge",
      mem.heapUsed
    ),
    metricLine(
      "uamsatech_nodejs_heap_total_bytes",
      "Node.js total allocated heap.",
      "gauge",
      mem.heapTotal
    ),
    metricLine(
      "uamsatech_nodejs_rss_bytes",
      "Node.js resident set size.",
      "gauge",
      mem.rss
    ),
    metricLine(
      "uamsatech_db_up",
      "Whether the database is reachable (1) or not (0).",
      "gauge",
      dbUp
    ),
    metricLine(
      "uamsatech_rate_limit_active_buckets",
      "Number of active in-memory rate-limit buckets. Only meaningful when uamsatech_rate_limit_backend_redis is 0 — Redis-backed counts aren't cheaply observable here.",
      "gauge",
      rateLimitBucketCount()
    ),
    metricLine(
      "uamsatech_rate_limit_backend_redis",
      "Whether rate limiting is currently backed by Redis (1) or the in-memory fallback (0).",
      "gauge",
      rateLimitBackend() === "redis" ? 1 : 0
    ),
    metricLine(
      "uamsatech_redis_configured",
      "Whether REDIS_URL is set (1) or not (0).",
      "gauge",
      isRedisConfigured() ? 1 : 0
    ),
    metricLine(
      "uamsatech_storage_configured",
      "Whether object storage (avatar uploads) is configured (1) or not (0).",
      "gauge",
      isStorageConfigured() ? 1 : 0
    ),
    metricLine(
      "uamsatech_users_total",
      "Total registered users.",
      "gauge",
      userCount
    ),
    metricLine(
      "uamsatech_organizations_total",
      "Total organizations.",
      "gauge",
      organizationCount
    ),
  ];

  return new Response(lines.join(""), {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
