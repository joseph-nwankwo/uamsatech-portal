/**
 * Gives ONE named portal account an active subscription to a product, for
 * testing launch/SSO before paid checkout exists for it. Writes the same
 * shape a paid checkout would (ACTIVE, with a paid-through date), minus any
 * payment-provider details, and always with an expiry so it cannot become
 * permanent access by accident.
 *
 * Never changes an existing subscription: if the account already has one for
 * the product, it reports it and stops.
 *
 *   node scripts/grant-test-subscription.mjs --email you@example.com                 # dry run
 *   node scripts/grant-test-subscription.mjs --email you@example.com --apply         # write it
 *   options: --product researchsuite (default)  --plan free (default)  --days 90 (default)
 *
 * Uses DATABASE_URL from the environment (or .env).
 */
import "dotenv/config";
import prismaClient from "@prisma/client";

const { PrismaClient } = prismaClient;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 &&
    process.argv[i + 1] &&
    !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}

function describeTarget() {
  try {
    const u = new URL(process.env.DATABASE_URL);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(DATABASE_URL is not set or not a URL)";
  }
}

async function main() {
  const email = arg("email");
  const productSlug = arg("product", "researchsuite");
  const planKey = arg("plan", "free");
  const days = Number(arg("days", "90"));
  const apply = process.argv.includes("--apply");

  if (!email) throw new Error("--email is required");
  if (!Number.isInteger(days) || days < 1 || days > 366)
    throw new Error("--days must be a whole number from 1 to 366");

  const db = new PrismaClient();
  console.log(`Database: ${describeTarget()}`);
  console.log(
    apply
      ? "Mode: APPLY\n"
      : "Mode: dry run (nothing is written; add --apply to write)\n"
  );

  try {
    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!user)
      throw new Error(
        `No portal account with email ${email}. Sign up on the portal first.`
      );
    const product = await db.product.findUnique({
      where: { slug: productSlug },
    });
    if (!product)
      throw new Error(
        `No product "${productSlug}". Run scripts/add-researchsuite-product.mjs --apply first.`
      );
    const productPlan = await db.productPlan.findFirst({
      where: { productId: product.id, plan: { key: planKey } },
    });
    if (!productPlan)
      throw new Error(`Product "${productSlug}" has no "${planKey}" plan.`);

    const existing = await db.subscription.findUnique({
      where: { userId_productId: { userId: user.id, productId: product.id } },
    });
    const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    console.log(`Account:  ${user.email}`);
    console.log(`Product:  ${product.name} (${planKey} plan)`);
    if (existing) {
      console.log(
        `\nThis account already has a ${product.name} subscription (status ${existing.status}, ` +
          `paid through ${existing.currentPeriodEnd?.toISOString() ?? "unknown"}). Left unchanged.`
      );
      return;
    }
    console.log(
      `Will create: ACTIVE subscription, expires ${endsAt.toISOString()} (${days} days)`
    );

    if (!apply) {
      console.log("\nDry run complete. Re-run with --apply to write it.");
      return;
    }
    await db.subscription.create({
      data: {
        userId: user.id,
        productId: product.id,
        productPlanId: productPlan.id,
        status: "ACTIVE",
        currentPeriodEnd: endsAt,
        cancelAtPeriodEnd: true,
      },
    });
    console.log("\nDone: subscription created.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
