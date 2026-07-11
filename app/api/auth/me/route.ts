import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { corsHeaders } from "@/lib/auth/cors";

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers }
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.sub },
    include: { memberships: { include: { organization: true } } },
  });

  if (!user) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: !!user.emailVerified,
      },
      organizationId: session.orgId ?? null,
      role: session.role ?? null,
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        name: m.organization.name,
        role: m.role,
      })),
    },
    { headers }
  );
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
