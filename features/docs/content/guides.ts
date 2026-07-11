import type { DocPage } from "@/features/docs/types";

export const guidesDocs: DocPage[] = [
  {
    slug: "creating-your-account",
    category: "guides",
    title: "Creating your account",
    description: "One account gets you into every UAMSATech product.",
    version: "v1",
    order: 1,
    blocks: [
      {
        type: "p",
        text: "Go to /signup and provide your name, email, and a password of at least 8 characters. Your account is created immediately — there's no waiting for approval — and you're signed in right away.",
      },
      {
        type: "p",
        text: "A verification email is sent to confirm your address. If email delivery isn't configured in an environment (like local development), the verification link is written to the server console instead, prefixed [DEV EMAIL FALLBACK].",
      },
      {
        type: "callout",
        tone: "info",
        text: "You don't have to verify your email before using your account — verification unlocks nothing by itself today, it's tracked (emailVerified) for future use.",
      },
    ],
  },
  {
    slug: "joining-an-organization",
    category: "guides",
    title: "Joining an organization",
    description: "Accepting an invitation from your institution.",
    version: "v1",
    order: 2,
    blocks: [
      {
        type: "p",
        text: "If someone at your institution invites you, you'll get an email with a link to /invite/<token>. Opening it shows who invited you, which organization, and what role you're being offered.",
      },
      {
        type: "p",
        text: 'If you don\'t have an account yet, the page\'s "Create an account" and "Sign in" buttons carry the invitation forward — you\'ll land right back on the same invite page after signing up or signing in, ready to accept.',
      },
      {
        type: "callout",
        tone: "warning",
        text: "An invitation can only be accepted by an account whose email matches the one it was sent to. If you're signed in as a different account, you'll see exactly that message instead of a confusing failure.",
      },
      {
        type: "p",
        text: "Accepting takes effect immediately — you're placed straight into the organization's portal, no separate \"select organization\" step. Invitations expire after 7 days; ask whoever invited you to send a new one if yours lapses.",
      },
    ],
  },
  {
    slug: "managing-your-team",
    category: "guides",
    title: "Managing your team",
    description: "Inviting, removing, and changing the role of team members.",
    version: "v1",
    order: 3,
    blocks: [
      {
        type: "p",
        text: "From /portal/users, owners and admins can invite a new member by email and starting role. A pending invitation shows up in its own list below the member table until it's accepted or revoked.",
      },
      {
        type: "p",
        text: 'Only owners can change another member\'s role. Removing a member is available to owners (any role) and admins (members only) — but not against yourself. To leave an organization you belong to, use "Leave organization" on the Organization page instead.',
      },
      {
        type: "list",
        items: [
          "The only remaining owner can't be demoted or removed — promote someone else to owner first.",
          "Admins can remove members, but not other admins or the owner.",
          "Every invite, role change, removal, and departure is recorded on the organization's Recent Activity page.",
        ],
      },
    ],
  },
  {
    slug: "understanding-roles-and-permissions",
    category: "guides",
    title: "Understanding roles & permissions",
    description: "What owners, admins, and members can each do.",
    version: "v1",
    order: 4,
    blocks: [
      {
        type: "p",
        text: "Every organization member has exactly one role: Owner, Admin, or Member.",
      },
      { type: "h2", text: "Owner" },
      {
        type: "p",
        text: "Full control: organization settings, billing, feature flags, and can change or remove any member, including other admins.",
      },
      { type: "h2", text: "Admin" },
      {
        type: "p",
        text: "Can invite and remove members, update organization settings, and view organization-wide activity. Cannot manage billing, feature flags, or change member roles.",
      },
      { type: "h2", text: "Member" },
      {
        type: "p",
        text: "Can access subscribed products and view their own account activity. Cannot manage the organization, members, or billing.",
      },
      {
        type: "callout",
        tone: "info",
        text: "This exact reference is also shown live on the Team Members page in the portal, generated from the same permissions table the API routes enforce — the description here can't drift out of sync with what the system actually does.",
      },
    ],
  },
  {
    slug: "security-and-sessions",
    category: "guides",
    title: "Security & sessions",
    description: "Changing your password and managing active sessions.",
    version: "v1",
    order: 5,
    blocks: [
      {
        type: "p",
        text: "From /portal/security you can change your password (you'll need your current one) and see every active session tied to your account, each shown by creation date.",
      },
      {
        type: "p",
        text: "Changing your password revokes every other session but deliberately leaves the one you're currently using signed in — you won't be logged out of the device you just used to change it. You can also revoke any single session individually, or all other sessions at once.",
      },
    ],
  },
];
