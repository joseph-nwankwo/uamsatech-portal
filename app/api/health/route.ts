import { NextResponse } from "next/server";

// Liveness probe — deliberately checks nothing external (no DB, no
// dependencies). Kubernetes/orchestrators restart the container if this
// fails, so it should only fail when the process itself is unhealthy, not
// when a downstream dependency like the database is temporarily down (that's
// what the separate readiness probe is for).
export async function GET() {
  return NextResponse.json({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
