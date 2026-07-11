import { developerDocs } from "@/features/docs/content/developer";
import { apiDocs } from "@/features/docs/content/api";
import { guidesDocs } from "@/features/docs/content/guides";
import { manualsDocs } from "@/features/docs/content/manuals";
import type { DocCategory, DocPage } from "@/features/docs/types";
import { DOC_CATEGORY_LABELS } from "@/features/docs/types";

export const allDocs: DocPage[] = [
  ...developerDocs,
  ...apiDocs,
  ...guidesDocs,
  ...manualsDocs,
];

export const docsByCategory: Record<DocCategory, DocPage[]> = {
  developer: developerDocs.slice().sort((a, b) => a.order - b.order),
  api: apiDocs.slice().sort((a, b) => a.order - b.order),
  guides: guidesDocs.slice().sort((a, b) => a.order - b.order),
  manuals: manualsDocs.slice().sort((a, b) => a.order - b.order),
};

export function getDoc(category: string, slug: string): DocPage | undefined {
  return allDocs.find((d) => d.category === category && d.slug === slug);
}

export const docsNav = (
  Object.entries(docsByCategory) as [DocCategory, DocPage[]][]
).map(([category, pages]) => ({
  category,
  label: DOC_CATEGORY_LABELS[category],
  pages: pages.map((p) => ({ slug: p.slug, title: p.title })),
}));

function flattenText(page: DocPage): string {
  return page.blocks
    .map((b) => {
      if (b.type === "list") return b.items.join(" ");
      if (b.type === "code") return "";
      return b.text;
    })
    .join(" ");
}

export type SearchEntry = {
  category: DocCategory;
  slug: string;
  title: string;
  description: string;
  text: string;
};

export const docsSearchIndex: SearchEntry[] = allDocs.map((page) => ({
  category: page.category,
  slug: page.slug,
  title: page.title,
  description: page.description,
  text: flattenText(page),
}));
