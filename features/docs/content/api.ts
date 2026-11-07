import type { DocPage } from "@/features/docs/types";

export const apiDocs: DocPage[] = [
  {
    slug: "overview",
    category: "api",
    title: "API overview",
    description: "What's actually public today, and what isn't.",
    version: "v1",
    order: 1,
    blocks: [
      {
        type: "p",
        text: "UAMSATech doesn't yet have a broad public API. Almost every route under /api/auth/* and /api/portal/* authenticates with the browser's own session cookie and exists to serve the portal's UI — calling them directly with an API key won't work, because they were never designed to be called by anything other than this app.",
      },
      {
        type: "p",
        text: "The one exception is /api/v1/usage, authenticated with a Bearer API key instead of a cookie. It exists specifically so the other products in the ecosystem (LectureSuite, ScholarSuite, and so on, once they're built) can report metered usage back to the organization that owns them.",
      },
      {
        type: "callout",
        tone: "info",
        text: "This is a deliberately small surface, not an oversight. Documenting internal cookie-authenticated routes as though they were a public API contract would be misleading — they can change shape at any time without notice, because nothing outside this app is meant to depend on them.",
      },
    ],
  },
  {
    slug: "authentication",
    category: "api",
    title: "API key authentication",
    description: "Creating and using an API key.",
    version: "v1",
    order: 2,
    blocks: [
      {
        type: "p",
        text: "API keys are created from the portal at /portal/api-keys (requires being signed in). The full key is shown exactly once, at creation time — only a SHA-256 hash and a short prefix are stored, so there's no way to retrieve a lost key; revoke it and create a new one instead.",
      },
      {
        type: "code",
        language: "bash",
        caption: "Creating a key",
        code: `curl -X POST https://uamsatech.com/api/portal/api-keys \\
  -H "Content-Type: application/json" \\
  --cookie "access_token=..." \\
  -d '{"name": "LectureSuite integration"}'`,
      },
      {
        type: "code",
        language: "json",
        caption: "Response — the fullKey field only ever appears here",
        code: `{
  "apiKey": { "id": "...", "name": "LectureSuite integration", "keyPrefix": "uamsa_live_l7Xn…", "createdAt": "..." },
  "fullKey": "uamsa_live_l7XndS-Kv3ZO0H1wTgIK7mltbUihAiRscbFjjtQWtyE"
}`,
      },
      {
        type: "p",
        text: "Use the full key as a Bearer token on any request to the usage API:",
      },
      {
        type: "code",
        language: "bash",
        code: `curl -X POST https://uamsatech.com/api/v1/usage \\
  -H "Authorization: Bearer uamsa_live_l7XndS-Kv3ZO0H1wTgIK7mltbUihAiRscbFjjtQWtyE" \\
  -H "Content-Type: application/json" \\
  -d '{"productSlug": "LectureSuite", "metric": "lecture_notes_generated", "quantity": 1}'`,
      },
      {
        type: "callout",
        tone: "warning",
        text: "A revoked key is rejected immediately on the next request (401 Invalid or missing API key.) — there's no grace period.",
      },
    ],
  },
  {
    slug: "usage-api",
    category: "api",
    title: "Usage API",
    description: "POST /api/v1/usage — report metered product usage.",
    version: "v1",
    order: 3,
    blocks: [
      {
        type: "p",
        text: "Records a unit of metered usage against the organization the API key belongs to. This is the data source behind the Usage page in the portal — every row shown there came through this endpoint.",
      },
      { type: "h2", text: "Request" },
      {
        type: "code",
        language: "json",
        caption: "Body",
        code: `{
  "productSlug": "LectureSuite",
  "metric": "lecture_notes_generated",
  "quantity": 5
}`,
      },
      {
        type: "list",
        items: [
          "productSlug — must match an existing product (uamsa, LectureSuite, ScholarSuite, records, studyflow).",
          "metric — a short string identifying what was used, 1–60 characters. Not a fixed enum; each product defines its own metric names.",
          "quantity — a positive integer.",
        ],
      },
      { type: "h2", text: "Responses" },
      {
        type: "code",
        language: "json",
        caption: "201 Created",
        code: `{ "usageRecord": { "id": "cmrc5x6de0009ut5oanvs5o6u" } }`,
      },
      {
        type: "list",
        items: [
          "401 — missing or invalid API key.",
          "400 — the API key isn't associated with an organization, or the request body failed validation.",
          "404 — productSlug doesn't match a known product.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "This exact request/response shape was exercised end-to-end during development: a key was created, used to report usage, confirmed on the Usage page, then revoked and confirmed rejected on the next call.",
      },
    ],
  },
];
