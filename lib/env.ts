import { z } from "zod";

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().min(1).default("http://localhost:3000"),
  AUTH_JWT_SECRET: z
    .string()
    .min(32, "AUTH_JWT_SECRET must be at least 32 characters"),

  // Shared with LectureSuite and ScholarSuite for SSO launch tokens.
  // Must NOT equal AUTH_JWT_SECRET (different purpose, different secret).
  CRAFT_LAUNCH_SECRET: z
    .string()
    .min(32, "CRAFT_LAUNCH_SECRET must be at least 32 characters"),

  // SSO target URLs — where each product's /api/auth/sso endpoint lives.
  LECTURESUITE_SSO_URL: z
    .string()
    .url()
    .default("http://localhost:4000/api/auth/sso"),
  SCHOLARSUITE_SSO_URL: z
    .string()
    .url()
    .default("http://localhost:4001/api/auth/sso"),
  RESEARCHSUITE_SSO_URL: z
    .string()
    .url()
    .default("http://localhost:4002/api/auth/sso"),

  // Server-to-server entitlement verification (AS-P0-SECURITY-006A).
  // One credential PER PRODUCT, presented by that product's backend as a
  // Bearer token to POST /api/internal/entitlements/verify. Optional at boot;
  // a product whose credential is unset is refused with 503 (fail closed).
  // Must differ from CRAFT_LAUNCH_SECRET, AUTH_JWT_SECRET and each other.
  LECTURESUITE_ENTITLEMENT_SERVICE_SECRET: z
    .string()
    .min(
      32,
      "LECTURESUITE_ENTITLEMENT_SERVICE_SECRET must be at least 32 characters"
    )
    .optional(),
  SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET: z
    .string()
    .min(
      32,
      "SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET must be at least 32 characters"
    )
    .optional(),
  COOKIE_DOMAIN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("UAMSATech <noreply@uamsatech.com>"),

  // Billing — all optional. Routes that need a provider check for its key at
  // request time and return a clear "not configured" error, rather than the
  // app failing to boot without payment credentials.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional(),

  // Admin — optional. Comma-separated allowlist of emails that may access
  // /admin. There is no staff/role system in this app; this is a
  // deliberately simple gate rather than new RBAC, since the internal
  // dashboards behind it (revenue, customer, marketing analytics) are
  // company-wide and must never be reachable by a customer org member.
  ADMIN_EMAILS: z.string().optional(),

  // Analytics — optional, public (client-side). Scripts simply don't load
  // when unset, same graceful-degradation pattern as the billing providers.
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_CLARITY_PROJECT_ID: z.string().optional(),

  // Metrics — optional. If set, GET /api/metrics requires this as a Bearer
  // token; if unset, the endpoint is open (expected to be firewalled to the
  // Prometheus scraper's network in a real deployment — see
  // deploy/nginx/uamsatech.conf, which restricts /metrics to internal IPs).
  METRICS_TOKEN: z.string().optional(),

  // Redis — optional. Rate limiting (lib/auth/rate-limit.ts) uses it when
  // set, falls back to the in-memory limiter when unset. No local Redis is
  // available to test against in this sandbox — see lib/redis.ts.
  REDIS_URL: z.string().optional(),

  // Object storage — optional, S3-compatible (works for real AWS S3, or
  // R2/MinIO/Cloudinary's S3-compatible endpoint via S3_ENDPOINT). Currently
  // used for portal profile avatar uploads only. All five must be set
  // together for storage to be considered configured — see lib/storage.ts.
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  // Base URL uploaded files are publicly served from (e.g. a CloudFront
  // distribution, or `https://<bucket>.s3.<region>.amazonaws.com`).
  S3_PUBLIC_URL: z.string().optional(),
});

// Exported for unit tests. The launch secret is shared with the product
// backends, so it must never double as the portal's own session secret.
export const envSchema = baseEnvSchema
  .refine((cfg) => cfg.CRAFT_LAUNCH_SECRET !== cfg.AUTH_JWT_SECRET, {
    message: "CRAFT_LAUNCH_SECRET must differ from AUTH_JWT_SECRET",
    path: ["CRAFT_LAUNCH_SECRET"],
  })
  .superRefine((cfg, ctx) => {
    // Each entitlement service credential is single-purpose.
    const reserved = [cfg.CRAFT_LAUNCH_SECRET, cfg.AUTH_JWT_SECRET];
    const services = [
      [
        "LECTURESUITE_ENTITLEMENT_SERVICE_SECRET",
        cfg.LECTURESUITE_ENTITLEMENT_SERVICE_SECRET,
      ],
      [
        "SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET",
        cfg.SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET,
      ],
    ] as const;
    for (const [name, value] of services) {
      if (value && reserved.includes(value)) {
        ctx.addIssue({
          code: "custom",
          path: [name],
          message: `${name} must differ from CRAFT_LAUNCH_SECRET and AUTH_JWT_SECRET`,
        });
      }
    }
    if (services[0][1] && services[0][1] === services[1][1]) {
      ctx.addIssue({
        code: "custom",
        path: ["SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET"],
        message: "Each product must have its own entitlement service secret",
      });
    }
  });

export const env = envSchema.parse(process.env);
