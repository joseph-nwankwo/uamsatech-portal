import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().min(1).default("http://localhost:3000"),
  AUTH_JWT_SECRET: z
    .string()
    .min(32, "AUTH_JWT_SECRET must be at least 32 characters"),
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

export const env = envSchema.parse(process.env);
