import type { DocPage } from "@/features/docs/types";

export const developerDocs: DocPage[] = [
  {
    slug: "getting-started",
    category: "developer",
    title: "Getting started",
    description: "How the UAMSATech platform is put together, in brief.",
    version: "v1",
    order: 1,
    blocks: [
      {
        type: "p",
        text: "UAMSATech is a Next.js 15 application (App Router) with a single PostgreSQL database behind it, accessed through Prisma. There's no separate backend service — every API route below lives in the same codebase as the marketing site and customer portal.",
      },
      {
        type: "p",
        text: "One account works across every product. Central authentication is cookie-based: a short-lived access token plus a longer-lived refresh token, both httpOnly. There is no client-side token storage to manage.",
      },
      { type: "h2", text: "What's documented here" },
      {
        type: "list",
        items: [
          "Developer Docs — how authentication, sessions, and webhooks actually work.",
          "API Reference — the one public, API-key-authenticated endpoint available today.",
          "User Guides — using your account and the customer portal.",
          "Product Manuals — what to expect from each product as it ships.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "Most of the routes under /api/auth/* and /api/portal/* are internal — they authenticate with the browser's session cookie and are called by the portal's own UI, not designed for third-party use. The API Reference section covers the one route that is: /api/v1/usage.",
      },
    ],
  },
  {
    slug: "authentication",
    category: "developer",
    title: "Authentication & sessions",
    description:
      "JWT access tokens, opaque refresh tokens, and how rotation works.",
    version: "v1",
    order: 2,
    blocks: [
      {
        type: "p",
        text: "Signing in issues two cookies: a signed JWT access token (15 minutes) and an opaque, randomly generated refresh token (30 days), hashed before it's stored — a database read of the refresh_tokens table never reveals a usable token.",
      },
      {
        type: "code",
        language: "typescript",
        caption: "lib/auth/jwt.ts",
        code: `export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export async function signAccessToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(\`\${ACCESS_TOKEN_TTL_SECONDS}s\`)
    .sign(secret);
}`,
      },
      {
        type: "p",
        text: "Refresh tokens rotate on every use: calling /api/auth/refresh revokes the current token and issues a new one, rather than extending the same token's life. A stolen, already-used refresh token is worthless.",
      },
      { type: "h2", text: "Login is timing-safe" },
      {
        type: "p",
        text: "A login attempt against a non-existent email still runs a bcrypt comparison of equivalent cost, against a precomputed dummy hash — the response time doesn't leak whether the account exists.",
      },
      {
        type: "code",
        language: "typescript",
        caption: "app/api/auth/login/route.ts",
        code: `const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", 12);

const valid = await verifyPassword(
  password,
  user?.passwordHash ?? DUMMY_HASH
);`,
      },
      { type: "h2", text: "Organization scoping" },
      {
        type: "p",
        text: "A session can be scoped to zero, or exactly one, organization at a time — the JWT carries an optional orgId and role claim. A user with more than one membership gets requiresOrgSelection: true back from login and is routed to pick one; a user with exactly one membership is scoped to it automatically.",
      },
      {
        type: "code",
        language: "json",
        caption: "POST /api/auth/login response",
        code: `{
  "user": { "id": "...", "name": "...", "email": "...", "emailVerified": true },
  "memberships": [
    { "organizationId": "...", "name": "Test University", "role": "OWNER" }
  ],
  "requiresOrgSelection": false
}`,
      },
      {
        type: "callout",
        tone: "warning",
        text: "Changing your password intentionally keeps the session you're currently using alive and only revokes your other sessions — you won't get logged out of the device you're using to change it.",
      },
    ],
  },
  {
    slug: "single-sign-on",
    category: "developer",
    title: "Single sign-on architecture",
    description: "How one account works across every *.uamsatech.com product.",
    version: "v1",
    order: 3,
    blocks: [
      {
        type: "p",
        text: 'In production, auth cookies are set with a shared COOKIE_DOMAIN (".uamsatech.com"), so a session established on one subdomain is automatically valid on every other *.uamsatech.com subdomain — no redirect-based SSO handshake needed.',
      },
      {
        type: "p",
        text: "For a subdomain to check who's logged in, it calls GET /api/auth/me, which is CORS-enabled for allowed origins and returns the current session's user, active organization, and role.",
      },
      {
        type: "code",
        language: "json",
        caption: "GET /api/auth/me response",
        code: `{
  "authenticated": true,
  "user": { "id": "...", "name": "...", "email": "...", "emailVerified": true },
  "organizationId": "...",
  "role": "OWNER",
  "memberships": [{ "organizationId": "...", "name": "...", "role": "OWNER" }]
}`,
      },
      {
        type: "callout",
        tone: "info",
        text: "COOKIE_DOMAIN is commented out in local development, since localhost doesn't have subdomains to share cookies across — it's a one-line uncomment for a real *.uamsatech.com deployment.",
      },
    ],
  },
  {
    slug: "webhooks",
    category: "developer",
    title: "Payment webhooks",
    description: "How Stripe, Paystack, and Flutterwave webhooks are verified.",
    version: "v1",
    order: 4,
    blocks: [
      {
        type: "p",
        text: "Each payment provider's webhook route verifies the request's signature before touching the database. An unconfigured provider (no secret key set) returns 503 rather than silently accepting unverified webhooks; a configured provider that receives a request with an invalid or missing signature returns 400.",
      },
      {
        type: "code",
        language: "typescript",
        caption: "app/api/billing/stripe/webhook/route.ts",
        code: `let event: Stripe.Event;
try {
  event = verifyStripeWebhookSignature(rawBody, signature);
} catch {
  return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
}`,
      },
      {
        type: "p",
        text: "On checkout.session.completed, the route reads the organizationId/productId/productPlanId metadata attached at checkout creation and upserts a Subscription row. On invoice.paid, it creates an Invoice row with the real amount, currency, and billing period from the provider's payload.",
      },
      {
        type: "callout",
        tone: "warning",
        text: "No live payment provider keys are configured in this environment. The signature-verification path has been exercised with temporary dummy keys during development and confirmed to correctly reject invalid and missing signatures — but no real transaction has been processed end-to-end.",
      },
    ],
  },
];
