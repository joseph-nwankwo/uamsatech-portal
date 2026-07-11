// The only non-identifying fallback for a commenter without a display name
// set. Never derive this from email — that would still be showing
// email-derived information on a public page. Split out of
// comments-section.tsx (a "use client" component) into its own plain module
// so it's testable without pulling in a JSX/React transform just for one
// pure function — see tests/unit/display-name.test.ts.
export function displayName(name: string | null): string {
  return name?.trim() || "Anonymous";
}
