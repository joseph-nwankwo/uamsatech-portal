const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

const PLANS = [
  {
    key: "free",
    name: "Free",
    description: "Limited access and trial features.",
    sortOrder: 0,
  },
  {
    key: "starter",
    name: "Starter",
    description: "For individuals.",
    sortOrder: 1,
  },
  {
    key: "professional",
    name: "Professional",
    description: "For power users and small teams.",
    sortOrder: 2,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Custom pricing and institution-wide deployment.",
    sortOrder: 3,
  },
];

// Real pricing provided by the product owner. UAMSA has none — it's
// quotation-only regardless of tier. Records has no Free tier. "Enterprise"
// rows below are starting/from prices where a real number was given
// (isStartingPrice: true); UAMSA and Records Enterprise have no number at
// all, so no row is seeded for them.
const PRODUCT_PLANS = [
  {
    productSlug: "lecturercraft",
    planKey: "free",
    interval: "MONTHLY",
    priceCents: 0,
    features: ["Core AI tools", "Single sign-on account"],
  },
  {
    productSlug: "lecturercraft",
    planKey: "starter",
    interval: "MONTHLY",
    priceCents: 1500,
    features: [
      "Everything in Free",
      "Full lecture note generation",
      "Question generator",
    ],
  },
  {
    productSlug: "lecturercraft",
    planKey: "professional",
    interval: "MONTHLY",
    priceCents: 3900,
    features: [
      "Everything in Starter",
      "Exam builder",
      "AI teaching assistant",
    ],
  },
  {
    productSlug: "lecturercraft",
    planKey: "enterprise",
    interval: "YEARLY",
    priceCents: 49900,
    isStartingPrice: true,
    features: [
      "Institution-wide deployment",
      "Dedicated onboarding",
      "Integrated with UAMSA",
    ],
  },

  {
    productSlug: "scholarcraft",
    planKey: "free",
    interval: "MONTHLY",
    priceCents: 0,
    features: ["Core AI tools", "Single sign-on account"],
  },
  {
    productSlug: "scholarcraft",
    planKey: "starter",
    interval: "MONTHLY",
    priceCents: 1200,
    features: [
      "Everything in Free",
      "Citation management",
      "Literature review support",
    ],
  },
  {
    productSlug: "scholarcraft",
    planKey: "professional",
    interval: "MONTHLY",
    priceCents: 3500,
    features: [
      "Everything in Starter",
      "Research assistant",
      "Journal writing tools",
    ],
  },
  {
    productSlug: "scholarcraft",
    planKey: "enterprise",
    interval: "YEARLY",
    priceCents: 39900,
    isStartingPrice: true,
    features: [
      "Institution-wide deployment",
      "Dedicated onboarding",
      "Integrated with UAMSA",
    ],
  },

  {
    productSlug: "studyflow",
    planKey: "free",
    interval: "MONTHLY",
    priceCents: 0,
    features: ["Core AI tools", "Single sign-on account"],
  },
  {
    productSlug: "studyflow",
    planKey: "starter",
    interval: "MONTHLY",
    priceCents: 800,
    features: ["Everything in Free", "Study planner", "Assignment tracker"],
  },
  {
    productSlug: "studyflow",
    planKey: "professional",
    interval: "MONTHLY",
    priceCents: 2000,
    features: ["Everything in Starter", "AI tutor", "Revision planner"],
  },
  {
    productSlug: "studyflow",
    planKey: "enterprise",
    interval: "YEARLY",
    priceCents: 29900,
    isStartingPrice: true,
    features: [
      "Institution-wide deployment",
      "Dedicated onboarding",
      "Integrated with UAMSA",
    ],
  },

  {
    productSlug: "records",
    planKey: "starter",
    interval: "MONTHLY",
    priceCents: 9900,
    features: [
      "Transcript generator",
      "QR verification",
      "Institution deployment",
    ],
  },
  {
    productSlug: "records",
    planKey: "professional",
    interval: "MONTHLY",
    priceCents: 29900,
    features: [
      "Everything in Starter",
      "Excel import",
      "Third-party SIS integration",
    ],
  },
  {
    productSlug: "researchsuite",
    planKey: "free",
    interval: "MONTHLY",
    priceCents: 0,
    features: ["Core writing wizard", "Single sign-on account"],
  },
  {
    productSlug: "researchsuite",
    planKey: "starter",
    interval: "MONTHLY",
    priceCents: 1200,
    features: ["Everything in Free", "Literature search", "Chapter guides"],
  },
  {
    productSlug: "researchsuite",
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
    productSlug: "researchsuite",
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

const FEATURE_FLAGS = [
  {
    key: "billing_paystack_enabled",
    name: "Paystack checkout",
    description: "Show Paystack as a checkout option on the billing page.",
    isEnabled: true,
  },
  {
    key: "billing_flutterwave_enabled",
    name: "Flutterwave checkout",
    description: "Show Flutterwave as a checkout option on the billing page.",
    isEnabled: true,
  },
];

const PRODUCTS = [
  { slug: "uamsa", name: "UAMSA" },
  { slug: "lecturercraft", name: "LecturerCraft" },
  { slug: "scholarcraft", name: "ScholarCraft" },
  { slug: "records", name: "Records" },
  { slug: "studyflow", name: "StudyFlow" },
  { slug: "researchsuite", name: "ResearchSuite" },
];

// Institutional bylines, not fabricated individual people — the blog is
// company-authored (see docs/03-marketing-website.md), and inventing a named
// "VP of Product" persona would be the same kind of fabricated social proof
// already deliberately avoided on the Customers and product pages.
const AUTHORS = [
  {
    slug: "uamsatech-team",
    name: "UAMSATech Team",
    title: "Company updates",
    bio: "Company-wide announcements and updates from UAMSATech.",
    initials: "UT",
  },
  {
    slug: "product-team",
    name: "Product Team",
    title: "Product",
    bio: "Notes on what we're building and why, from the people building it.",
    initials: "PT",
  },
];

const CATEGORIES = [
  { slug: "product", name: "Product" },
  { slug: "teaching", name: "Teaching" },
  { slug: "company", name: "Company" },
];

const TAGS = [
  { slug: "product", name: "Product" },
  { slug: "sso", name: "SSO" },
  { slug: "ecosystem", name: "Ecosystem" },
  { slug: "ai", name: "AI" },
  { slug: "lecturercraft", name: "LecturerCraft" },
  { slug: "productivity", name: "Productivity" },
  { slug: "company", name: "Company" },
  { slug: "africa", name: "Africa" },
  { slug: "payments", name: "Payments" },
  { slug: "records", name: "Records" },
];

const BLOG_POSTS = [
  {
    slug: "introducing-uamsatech",
    title: "Introducing UAMSATech: one account, five products",
    excerpt:
      "Why we built a single platform for university administration, teaching, research, and academic records, instead of five separate tools.",
    authorSlug: "product-team",
    categorySlug: "product",
    tagSlugs: ["product", "sso", "ecosystem"],
    publishedAt: "2026-01-15T09:00:00.000Z",
    content: [
      "Most universities and lecturers we spoke to weren't short on software — they were short on software that worked together. A registrar's office running one system for admissions, another for results, and a third for transcripts. A lecturer copying grades between a spreadsheet and whatever the university's portal happens to be.",
      "UAMSATech starts from a different premise: one account should get you everything. UAMSA handles the institutional core — admissions, students, staff, courses, results, fees. LecturerCraft, ScholarCraft, StudyFlow, and Records each solve a specific problem for a specific role, and every one of them talks to the others through the same sign-on.",
      "That means a university can roll out UAMSA institution-wide, and its lecturers, students, and registrars pick up LecturerCraft, ScholarCraft, StudyFlow, or Records without a second account, a second invoice, or a second support line.",
      "We're building this for higher education in Africa first, with local payment support (Paystack, Flutterwave, alongside Stripe) from day one, not bolted on later.",
    ],
  },
  {
    slug: "ai-teaching-assistant-time-back",
    title: "5 ways an AI teaching assistant gives lecturers their time back",
    excerpt:
      "Lecture prep, assignment marking, and exam building eat into research and teaching time. Here's where AI actually helps.",
    authorSlug: "product-team",
    categorySlug: "teaching",
    tagSlugs: ["ai", "lecturercraft", "productivity"],
    publishedAt: "2026-02-03T09:00:00.000Z",
    content: [
      "Lecturers don't need AI to teach for them — they need it to take the repetitive parts of course prep off their plate. That's the design principle behind LecturerCraft.",
      "1. Lecture notes from a syllabus. Turn a course outline into structured lecture notes in the format you already use, then edit from there instead of starting from a blank page.",
      "2. Question banks that don't repeat. Generate assessment questions at a specified difficulty and topic spread, so you're not reusing the same three exam questions every semester.",
      "3. Marking schemes before you mark. Draft a rubric alongside the assignment itself, so grading is consistent across a large class and multiple markers.",
      "4. Course outlines that meet accreditation language. Get a first draft that already uses the phrasing your faculty's review committee expects.",
      "5. A teaching assistant that knows your course. Ask it questions about your own uploaded material, not generic web content, when you're prepping the next session at 11pm.",
      "None of this replaces judgment about what to teach — it just removes the blank-page problem from the parts of the job that are necessary but not the reason anyone became a lecturer.",
    ],
  },
  {
    slug: "building-for-africa-first",
    title: "Why we're building for Africa first",
    excerpt:
      "Local payment rails, institution-scale pricing, and product decisions shaped by African higher education from the start.",
    authorSlug: "uamsatech-team",
    categorySlug: "company",
    tagSlugs: ["company", "africa", "payments"],
    publishedAt: "2026-02-20T09:00:00.000Z",
    content: [
      "Most academic software available to African universities today was designed for a different market and later localized, if at all. We wanted to flip that: design for the constraints and scale of African higher education first, and treat everything else as the exception.",
      "Practically, that means: Paystack and Flutterwave as first-class payment options next to Stripe, not an afterthought. Pricing that works for both a single lecturer paying out of pocket and a public university with tens of thousands of students. And a product roadmap shaped by conversations with registrars and lecturers who are currently solving these problems with spreadsheets and WhatsApp groups, not by guessing.",
      "We're still early. If you're at a university, a lecturer, or a registrar dealing with any of the problems UAMSA, LecturerCraft, ScholarCraft, StudyFlow, or Records are meant to solve, we'd genuinely like to hear from you — see our Customers page for how to get involved as a founding partner.",
    ],
  },
  {
    slug: "digital-student-records-best-practices",
    title: "Digital Student Records: Benefits and Best Practices",
    excerpt:
      "Paper transcripts and siloed spreadsheets don't scale and don't survive a disaster. Here's what actually matters when moving student records digital.",
    authorSlug: "product-team",
    categorySlug: "product",
    tagSlugs: ["records", "product"],
    publishedAt: "2026-07-10T09:00:00.000Z",
    content: [
      "Most registrar's offices we've talked to aren't dealing with one records problem — they're dealing with several at once: a paper archive that's one flood or fire away from being gone, results scattered across departmental spreadsheets that don't agree with each other, and a transcript-request process that takes days because every request means someone physically pulling a file.",
      "The case for going digital isn't really about convenience. It's about risk. A single physical archive has no backup by default. A spreadsheet with no access log has no way to tell you who changed a grade, or when. A paper certificate has no way for a third party — an employer, another university, an immigration office — to confirm it's genuine without calling your office directly and hoping someone picks up.",
      "Faster issuance. Once a result is entered once, generating a transcript, a composite result, or a mark sheet from it is a report, not a research project. What used to take a registrar's office days of file-pulling becomes a request that resolves in minutes.",
      "Verifiability that doesn't depend on your office being open. A digital record with a scannable verification code lets a third party confirm authenticity themselves, instantly, without a phone call. This matters most exactly when it's hardest to provide the old way — outside office hours, across time zones, or years after a student has graduated.",
      "Fewer conflicting copies. The moment a result lives in more than one place — a lecturer's spreadsheet, a departmental system, the registrar's own records — those copies will eventually disagree, and someone has to manually decide which one is right. A single system of record removes the disagreement instead of resolving it after the fact.",
      "A real backup, not just an assumption of one. \"We've never lost the archive\" is not a backup strategy, it's a streak. Moving records digital only delivers this benefit if backups are actually scheduled, actually tested, and actually stored somewhere other than the same room as the primary copy.",
      "None of this requires re-keying years of paper records by hand — the actual migration work is usually importing what already exists (most institutions' historical results already live in *some* spreadsheet) rather than starting from a blank system. That's the specific problem Records is built to solve: transcript, composite result, and mark sheet generation, Excel import for existing data, and QR verification so a credential can be checked by anyone, not just by calling the registrar.",
    ],
  },
];

// Real, honest support content only — same rule as the Docs platform (Phase
// 9): document the actually-built system (auth, SSO, billing, org
// management), not fabricated feature specs for the 5 unbuilt SaaS products.
// Deliberately distinct from features/docs/content/guides.ts: Docs explains
// how the system works, this is troubleshooting/support-ticket-deflection
// content — "why isn't X working" rather than "here's how X works".
const KNOWLEDGE_BASE_ARTICLES = [
  {
    slug: "verification-email-not-received",
    category: "Getting Started",
    title: "I didn't receive my verification email",
    excerpt:
      "What to check, and why you can keep using your account either way.",
    content: [
      "A verification email is sent automatically when you sign up. If it hasn't arrived, check your spam folder first — automated mail from a new sender is sometimes filtered.",
      "In local/development environments without an email provider configured, verification links aren't actually emailed — they're written to the server console instead, prefixed [DEV EMAIL FALLBACK], so a developer can copy the link directly.",
      "Verifying your email doesn't unlock anything by itself today — it's tracked on your account for future use. You can keep using UAMSATech normally without it.",
    ],
  },
  {
    slug: "one-account-every-product",
    category: "Getting Started",
    title: "How does one account work across every UAMSATech product?",
    excerpt: "Single sign-on explained, and what it does (and doesn't) do.",
    content: [
      "Your UAMSATech account works across every product in the ecosystem — UAMSA, LecturerCraft, ScholarCraft, Records, and StudyFlow — without creating a separate login for each.",
      "This works through a shared authentication cookie scoped to *.uamsatech.com, plus a cross-subdomain endpoint each product calls to confirm who you are. Signing in on one product signs you in everywhere; signing out does the same in reverse.",
      "Products themselves are independent — being subscribed to LecturerCraft doesn't automatically grant access to ScholarCraft. SSO means one identity, not one bundled subscription.",
    ],
  },
  {
    slug: "understanding-your-billing",
    category: "Billing & Subscriptions",
    title: "Understanding your organization's billing",
    excerpt: "How plans, invoices, and payment providers work today.",
    content: [
      "Billing is managed at the organization level, from Billing in your portal sidebar. Owners and admins can see every product's available plans and subscribe your organization to one.",
      "Every payment recorded against your organization appears in your invoice history on the same page, with its amount, provider, and status.",
      "Honestly: there's currently no self-serve way to downgrade, cancel, or switch a plan from the portal. If you need to change your organization's plan, contact support and we'll take care of it directly — this is a known gap, not an oversight.",
    ],
  },
  {
    slug: "payment-providers-supported",
    category: "Billing & Subscriptions",
    title: "Which payment providers do you support?",
    excerpt:
      "Stripe, Paystack, and Flutterwave — and what happens if one isn't configured.",
    content: [
      "UAMSATech supports three payment providers: Stripe, Paystack, and Flutterwave, so institutions can pay with whichever is most accessible to them.",
      "If a provider isn't configured on our end yet, checkout for that provider returns a clear service-unavailable response rather than a confusing failure — it fails safely, not silently.",
      "Paystack and Flutterwave can each be toggled on independently once configured, without a code change, through an internal feature flag.",
    ],
  },
  {
    slug: "invitation-link-not-working",
    category: "Team & Organization",
    title: "My invitation link isn't working",
    excerpt: "Expired links, email mismatches, and what to do next.",
    content: [
      "Invitation links expire 7 days after they're sent. If yours is older than that, ask whoever invited you to send a new one from Team Members in their portal.",
      "An invitation can only be accepted by an account whose email matches exactly the one it was sent to. If you're signed in as a different account, sign out and sign in (or sign up) with the invited email address instead.",
      "If a new invite still doesn't work, it's worth opening a support ticket — there may be a pending invitation already blocking a duplicate one.",
    ],
  },
  {
    slug: "only-owner-cant-leave",
    category: "Team & Organization",
    title: "I'm the only owner and can't leave my organization",
    excerpt: "Why this is blocked, and how to hand off ownership first.",
    content: [
      "An organization always needs at least one owner, so the last remaining owner can't be demoted, removed, or leave the organization — this is intentional, not a bug.",
      "To leave, first promote another member to Owner from Team Members (only an existing owner can do this), then leave normally from the Organization page.",
      "If you're leaving the organization entirely and no one else should take over, contact support instead of trying to force it through the portal.",
    ],
  },
  {
    slug: "cant-log-in",
    category: "Troubleshooting",
    title: "I can't log in",
    excerpt: "Common causes, in the order worth checking.",
    content: [
      "Wrong password is the most common cause — use Forgot password on the login page to reset it; the reset link works the same [DEV EMAIL FALLBACK] way as verification emails in environments without an email provider configured.",
      "If you were signed in previously and suddenly aren't, your session may have simply expired — access sessions last 15 minutes and refresh automatically while you're active, but a long period away can require signing in again.",
      "If you've reset your password and still can't get in, open a support ticket with the email address on your account — we can look up what's happening on our end.",
    ],
  },
];

async function main() {
  for (const product of PRODUCTS) {
    await db.product.upsert({
      where: { slug: product.slug },
      update: { name: product.name },
      create: product,
    });
  }
  console.log(`Seeded ${PRODUCTS.length} products.`);

  for (const plan of PLANS) {
    await db.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        description: plan.description,
        sortOrder: plan.sortOrder,
      },
      create: plan,
    });
  }
  console.log(`Seeded ${PLANS.length} plans.`);

  for (const pp of PRODUCT_PLANS) {
    const product = await db.product.findUnique({
      where: { slug: pp.productSlug },
    });
    const plan = await db.plan.findUnique({ where: { key: pp.planKey } });
    if (!product || !plan) {
      console.warn(
        `Skipping ${pp.productSlug}/${pp.planKey} — product or plan not found`
      );
      continue;
    }
    await db.productPlan.upsert({
      where: { productId_planId: { productId: product.id, planId: plan.id } },
      update: {
        interval: pp.interval,
        priceCents: pp.priceCents,
        currency: "USD",
        isStartingPrice: pp.isStartingPrice ?? false,
        features: pp.features,
      },
      create: {
        productId: product.id,
        planId: plan.id,
        interval: pp.interval,
        priceCents: pp.priceCents,
        currency: "USD",
        isStartingPrice: pp.isStartingPrice ?? false,
        features: pp.features,
      },
    });
  }
  console.log(`Seeded ${PRODUCT_PLANS.length} product plans.`);

  for (const flag of FEATURE_FLAGS) {
    await db.featureFlag.upsert({
      where: { key: flag.key },
      update: { name: flag.name, description: flag.description },
      create: flag,
    });
  }
  console.log(`Seeded ${FEATURE_FLAGS.length} feature flags.`);

  for (const author of AUTHORS) {
    await db.author.upsert({
      where: { slug: author.slug },
      update: {
        name: author.name,
        title: author.title,
        bio: author.bio,
        initials: author.initials,
      },
      create: author,
    });
  }
  console.log(`Seeded ${AUTHORS.length} authors.`);

  for (const category of CATEGORIES) {
    await db.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);

  for (const tag of TAGS) {
    await db.tag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name },
      create: tag,
    });
  }
  console.log(`Seeded ${TAGS.length} tags.`);

  for (const post of BLOG_POSTS) {
    const author = await db.author.findUnique({
      where: { slug: post.authorSlug },
    });
    const category = await db.category.findUnique({
      where: { slug: post.categorySlug },
    });
    await db.blogPost.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        publishedAt: new Date(post.publishedAt),
        authorId: author?.id,
        categoryId: category?.id,
        tags: {
          set: post.tagSlugs.map((slug) => ({ slug })),
        },
      },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        publishedAt: new Date(post.publishedAt),
        authorId: author?.id,
        categoryId: category?.id,
        tags: {
          connect: post.tagSlugs.map((slug) => ({ slug })),
        },
      },
    });
  }
  console.log(`Seeded ${BLOG_POSTS.length} blog posts.`);

  for (const article of KNOWLEDGE_BASE_ARTICLES) {
    await db.knowledgeBaseArticle.upsert({
      where: { slug: article.slug },
      update: {
        title: article.title,
        category: article.category,
        excerpt: article.excerpt,
        content: article.content,
      },
      create: article,
    });
  }
  console.log(
    `Seeded ${KNOWLEDGE_BASE_ARTICLES.length} knowledge base articles.`
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
