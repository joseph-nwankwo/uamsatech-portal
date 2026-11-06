# AS-P0-SECURITY-007 — design artifacts (NOT a migration)

These files are the validated **design** for the central billing and entitlement schema
described in `../AS-P0-SECURITY-007-CENTRAL-BILLING-SCHEMA-REPORT.md`.

**Nothing here is applied by any tool.**

- The `.proposal` suffixes are deliberate, so Prisma and reviewers never mistake these files for the live schema or a migration.
- Migration governance (report §4, decisions G1–G3) must be approved before any of this becomes a real migration, in AS-P0-SECURITY-007B.

| File | What it is |
|---|---|
| `additions.prisma.proposal` | The additive models and enums (10 tables, 14 enums) |
| `supplement.sql.proposal` | Constraints Prisma cannot express: partial unique indexes, CHECKs, the seat-capacity trigger, immutable grant windows, the append-only audit trigger |
| `build.cjs.proposal` | Builds a **proposed** schema from the repository `prisma/schema.prisma` (read-only) plus the additions, the D7 invoice change and back-relations |
| `validate.cjs.proposal` | Applies the SQL to a **throwaway** database on a **loopback** server, runs 56 behavioural assertions, and always drops it. Refuses non-loopback servers and redacts credentials |

The scripts carry the `.proposal` suffix too, so the project's `eslint .` and every other tool ignore this folder. Copy them out to run them.

## Reproduce

Run from `uamsatech/`. These commands need **no database**; set a dummy `DATABASE_URL` so nothing can connect.

```bash
export DATABASE_URL='postgresql://x:x@127.0.0.1:1/x'
W=<a scratch directory outside the repo>
cp docs/AS-P0-SECURITY-007-design/additions.prisma.proposal "$W/additions.prisma"
cp docs/AS-P0-SECURITY-007-design/supplement.sql.proposal  "$W/supplement.sql"
cp docs/AS-P0-SECURITY-007-design/build.cjs.proposal        "$W/build.cjs"
cp docs/AS-P0-SECURITY-007-design/validate.cjs.proposal     "$W/validate.cjs"
node "$W/build.cjs" prisma/schema.prisma "$W/additions.prisma" "$W/proposed.prisma"
npx prisma validate --schema "$W/proposed.prisma"
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel "$W/proposed.prisma" --script > "$W/additive.sql"
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > "$W/baseline-current.sql"
```

Optionally, to validate against PostgreSQL, run `node "$W/validate.cjs"`.

- It creates and drops its own throwaway database.
- It needs a **local development** server only.
- Never point it at a shared or production server. It aborts unless the host is loopback.
