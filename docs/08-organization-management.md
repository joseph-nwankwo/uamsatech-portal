# Phase 8 — Organization Management

All 7 requested pieces built (Institution Profile, Team Members, Invitations, Roles, Permissions, Audit Logs, Organization Settings) — including Invitations, the one piece explicitly deferred in Phase 6 ("no invite-by-email flow, since building it half-working would be worse than not having it yet"). This phase built it properly, and it's the first phase this session with a clean 18/18 E2E pass on the first attempt.

## Invitations — the big net-new piece

New `Invitation` model, same hashed-single-use-token pattern as `VerificationToken` (`generateOpaqueToken`/`hashToken` reused directly, no duplicate crypto code). Full lifecycle:

- **Create** (`POST /api/portal/invitations`, `members.invite` permission) — rejects if the email is already a member, rejects a second invite while one is still pending (`409`), but **upserts** so re-inviting after expiry/revocation works cleanly on the same row (`@@unique([email, organizationId])`).
- **Accept** (`POST /api/portal/invitations/accept`) — requires a logged-in session, and **enforces that the session's email matches the invitation's email** (case-insensitive) — this closes an obvious hijack path where someone else's invite link gets clicked by the wrong logged-in account. On success it creates the `Membership` and calls `issueSession()` directly, so acceptance lands the user straight in the portal already scoped to the new org — no extra "select organization" step.
- **Revoke** (`DELETE /api/portal/invitations/[id]`).
- **`/invite/[token]` page** — shows org name, role, and inviter for a valid invite; if the visitor isn't logged in, both "Create an account" and "Sign in" carry `redirect_uri=/invite/<token>` forward so they land back here after auth. If logged in as the wrong email, shows a clear message instead of silently failing.

**Real gap this closed:** `login-form.tsx` already supported `redirect_uri`; `signup-form.tsx` didn't, and neither preserved it when a user switched between the two forms (someone on `/login?redirect_uri=...` clicking "Sign up" would lose the invite context entirely). Both fixed this phase — this was necessary for new users (the common case) to complete an invite flow at all.

## Permissions — centralized, not scattered

`lib/portal/permissions.ts` defines 7 permissions (`organization.manage`, `members.invite`, `members.remove`, `members.changeRole`, `billing.manage`, `featureFlags.manage`, `activity.viewOrganization`) mapped per role, plus `ROLE_DESCRIPTIONS` for the reference table rendered on `/portal/users`. The pre-existing `organization/route.ts` PATCH handler had its own ad-hoc `role !== "OWNER" && role !== "ADMIN"` check — refactored to use `hasPermission()` instead, so there's one source of truth instead of copies drifting apart across routes.

## Roles — change, with real safeguards

`PATCH /api/portal/members/[membershipId]` (OWNER-only, `members.changeRole`). Two safeguards, both verified by actually triggering them, not just reading the code:

- Can't demote the only remaining OWNER (`400` if `countOwners <= 1` before the demotion).
- `DELETE` (remove member) rejects removing yourself (`"Use \"Leave organization\" instead"`), rejects removing the last OWNER, and restricts ADMIN to only removing MEMBERs (not other ADMINs or the OWNER).

## Audit Logs — now organization-scoped

`AuditLog` gained an optional `organizationId`. `logActivity()` takes it as a new optional last parameter (existing call sites untouched — no breaking change). `/portal/activity` now branches on `hasPermission(role, "activity.viewOrganization")`: OWNER/ADMIN see every action across the organization with a "Who" column (attributed by name/email, "You" for their own); MEMBER sees only their own actions, same as before. **This was verified as two genuinely different views in E2E testing**, not just code-reviewed — logged in as both the OWNER and the MEMBER and confirmed the OWNER saw the MEMBER's "Joined the organization" entry while the MEMBER did not see the OWNER's "Invited a member" entry.

Every new mutation in this phase logs to it: `member.invited`, `member.invitation_revoked`, `member.invitation_accepted`, `member.role_changed`, `member.removed`, `organization.left`.

## Organization Settings — leave organization

`/portal/organization` now has two sections: "Institution profile" (the existing rename form, unchanged) and a danger-zone "Leave organization" card — the first genuinely destructive self-service action in the portal, so it gets a confirmation dialog, not a bare button. `POST /api/portal/organization/leave` has the same last-owner safeguard as role removal, deletes the membership, logs `organization.left`, and re-issues a session with no `organizationId` (verified via `/api/auth/me` returning `organizationId: null`).

## First real (non-demo) use of Dialog

Phase 2's Dialog component was demoed on `/design-system` with a note "ready to reuse once the portal needs one." This phase is that moment — three real uses: the invite-member dialog, the remove-member confirmation (replaced an earlier icon-button-that-deletes-on-click design that had no confirmation step at all — caught and fixed before shipping, not after), and the leave-organization confirmation.

## Build issue hit and fixed

`next build` failed on `/signup`: `useSearchParams() should be wrapped in a suspense boundary`. `signup-form.tsx` gained `useSearchParams()` for the first time this phase (for `redirect_uri` support); `login-form.tsx` already had the same hook and was already wrapped in `<Suspense>` at the page level (`app/login/page.tsx`) — the same wrapper just hadn't been applied to `app/signup/page.tsx` since it never needed it before. One-line fix, same pattern, rebuild succeeded clean.

## Verification

`tsc --noEmit`, `eslint`, `prettier --write` all clean.

**Full E2E test, 18 scenarios, all passed on the first attempt** against the live database — the first phase this session with zero bugs found during testing (Phase 6 and 7 both needed at least one fix after E2E surfaced something real):

1. Login as OWNER of an existing org.
2. Team Members page renders (heading, invite button, permissions reference).
3. Invite sent → `201`, real token extracted from the `[DEV EMAIL FALLBACK]` console log.
4. Pending invitation shows on the page.
5. Duplicate invite → `409`.
6. Unauthenticated `/invite/[token]` shows org/role/inviter + sign-up/sign-in prompts.
7. New user signs up → accepts invite → `200` with organization name.
8. Session confirmed scoped to the org as MEMBER via `/api/auth/me`.
9. OWNER's activity view shows org-wide entries with correct attribution.
10. MEMBER's activity view shows **only their own** entry — the permission gate genuinely restricts visibility, confirmed by comparing both views side by side.
11. Role changed MEMBER → ADMIN, confirmed via re-fetch.
12. OWNER attempting to remove themselves → `400`, correct message.
13. OWNER attempting to demote themselves while the only OWNER → `400`, correct message.
14. OWNER successfully removes the ADMIN.
15. Re-invited, re-accepted, then self-service left the organization → `200`, session's `organizationId` confirmed `null` afterward.
16. `organization.left` confirmed in the audit log.
17. A separately created invitation was revoked → `200`, confirmed no longer in the pending list.
18. All 6 other portal pages + 2 marketing pages regression-checked — no issues.

Production build: **75 pages** — 6 new routes this phase (`/invite/[token]` plus 5 new `/api/portal/invitations*` and `/api/portal/members*`/`/api/portal/organization/leave` routes), all correctly dynamic; `/signup` correctly stayed static after the Suspense fix.
