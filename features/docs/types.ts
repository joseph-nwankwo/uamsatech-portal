export type DocCategory = "developer" | "api" | "guides" | "manuals";

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  developer: "Developer Docs",
  api: "API Reference",
  guides: "User Guides",
  manuals: "Product Manuals",
};

export const DOC_CATEGORY_DESCRIPTIONS: Record<DocCategory, string> = {
  developer:
    "How UAMSATech's authentication, sessions, and webhooks actually work under the hood.",
  api: "The one public, API-key-authenticated endpoint available today, and how to call it.",
  guides:
    "Step-by-step guides for using your UAMSATech account and the customer portal.",
  manuals:
    "What to expect from each product in the UAMSATech ecosystem as it ships.",
};

export type DocBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; tone: "info" | "warning"; text: string }
  | {
      type: "code";
      language: "bash" | "json" | "typescript" | "text";
      code: string;
      caption?: string;
    };

export type DocPage = {
  slug: string;
  category: DocCategory;
  title: string;
  description: string;
  version: "v1";
  order: number;
  blocks: DocBlock[];
};
