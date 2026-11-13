/**
 * Adds the ResearchSuite product and its plans to an existing database,
 * without running the full seed (which would reset every product's prices,
 * help articles and feature flags to the seed file's values).
 *
 * Only ever ADDS missing ResearchSuite rows. Existing rows are left exactly as
 * they are, so production edits (prices, Stripe/Paystack IDs) are preserved.
 *
 *   node scripts/add-researchsuite-product.mjs           # dry run: shows what it would do
 *   node scripts/add-researchsuite-product.mjs --apply   # writes the missing rows
 *
 * Uses DATABASE_URL from the environment (or .env).
 */
import "dotenv/config";
import prismaClient from "@prisma/client";

const { PrismaClient } = prismaClient;

const PRODUCT = { slug: "researchsuite", name: "ResearchSuite" };

// Kept identical to the researchsuite entries in prisma/seed.js.
const PRODUCT_PLANS = [
  {
    planKey: "free",
    interval: "MONTHLY",
    priceCents: 0,
    features: ["Core writing wizard", "Single sign-on account"],
  },
  {
    planKey: "starter",
    interval: "MONTHLY",
    priceCents: 1200,
    features: ["Everything in Free", "Literature search", "Chapter guides"],
  },
  {
    planKey: "professional",
    interval: "MONTHLY",
    priceCents: 3500,
    features: [
      "Everything in Starter",
      "Paraphraser and summarizer",
      "Similarity checker",
    ],
  },
  {
    planKey: "enterprise",
    interval: "YEARLY",
    priceCents: 39900,
    isStartingPrice: true,
    features: [
      "Institution-wide deployment",
      "Dedicated onboarding",
      "Single sign-on across products",
    ],
  },
];

function describeTarget() {
  try {
    const u = new URL(process.env.DATABASE_URL);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(DATABASE_URL is not set or not a URL)";
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient();
  console.log(`Database: ${describeTarget()}`);
  console.log(
    apply
      ? "Mode: APPLY (writing missing rows)\n"
      : "Mode: dry run (nothing is written; add --apply to write)\n"
  );

  try {
    const plans = await db.plan.findMany({
      where: { key: { in: PRODUCT_PLANS.map((p) => p.planKey) } },
    });
    const planByKey = new Map(plans.map((p) => [p.key, p]));
    const missingPlans = PRODUCT_PLANS.map((p) => p.planKey).filter(
      (k) => !planByKey.has(k)
    );
    if (missingPlans.length) {
      throw new Error(
        `Plans missing from this database: ${missingPlans.join(", ")}. Nothing was changed.`
      );
    }

    const existingProduct = await db.product.findUnique({
      where: { slug: PRODUCT.slug },
    });
    console.log(
      existingProduct
        ? `Product "${PRODUCT.slug}": already exists, left unchanged`
        : `Product "${PRODUCT.slug}": will be created`
    );

    const existingLinks = existingProduct
      ? await db.productPlan.findMany({
          where: { productId: existingProduct.id },
        })
      : [];
    const linkedPlanIds = new Set(existingLinks.map((l) => l.planId));
    const toCreate = PRODUCT_PLANS.filter(
      (p) => !linkedPlanIds.has(planByKey.get(p.planKey).id)
    );
    for (const p of PRODUCT_PLANS) {
      const label = `${p.planKey} ($${(p.priceCents / 100).toFixed(2)} ${p.interval.toLowerCase()})`;
      console.log(
        `  Plan ${label}: ${toCreate.includes(p) ? "will be created" : "already exists, left unchanged"}`
      );
    }

    if (!apply) {
      console.log(
        "\nDry run complete. Re-run with --apply to write these changes."
      );
      return;
    }
    if (existingProduct && toCreate.length === 0) {
      console.log("\nNothing to do: ResearchSuite is already fully set up.");
      return;
    }

    await db.$transaction(async (tx) => {
      const product =
        existingProduct ?? (await tx.product.create({ data: PRODUCT }));
      for (const p of toCreate) {
        await tx.productPlan.create({
          data: {
            productId: product.id,
            planId: planByKey.get(p.planKey).id,
            interval: p.interval,
            priceCents: p.priceCents,
            currency: "USD",
            isStartingPrice: p.isStartingPrice ?? false,
            features: p.features,
          },
        });
      }
    });
    console.log(
      `\nDone: ${existingProduct ? "product kept" : "product created"}, ${toCreate.length} plan(s) created.`
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
