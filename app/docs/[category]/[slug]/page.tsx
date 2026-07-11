import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { H1, Lead } from "@/components/ui/typography";
import { VersionBadge } from "@/features/docs/components/version-badge";
import { DocContent } from "@/features/docs/components/doc-content";
import { allDocs, getDoc } from "@/features/docs";

export function generateStaticParams() {
  return allDocs.map((doc) => ({ category: doc.category, slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const doc = getDoc(category, slug);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/docs/${category}/${slug}` },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const doc = getDoc(category, slug);
  if (!doc) notFound();

  return (
    <article className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <H1 className="text-2xl sm:text-3xl">{doc.title}</H1>
        <VersionBadge version={doc.version} />
      </div>
      <Lead className="mt-2 text-base">{doc.description}</Lead>

      <div className="mt-10">
        <DocContent blocks={doc.blocks} />
      </div>
    </article>
  );
}
