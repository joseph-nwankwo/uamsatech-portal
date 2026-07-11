import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Readiness probe — checks the database is actually reachable. An
// orchestrator uses this to decide whether to route traffic to this
// instance, not whether to restart it, so a failure here should pull the
// instance out of rotation rather than kill it.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ready",
      checks: { database: "ok" },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "not_ready",
        checks: { database: "unreachable" },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
