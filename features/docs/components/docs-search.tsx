"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { docsSearchIndex } from "@/features/docs";
import { DOC_CATEGORY_LABELS } from "@/features/docs/types";

export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return docsSearchIndex
      .filter(
        (entry) =>
          entry.title.toLowerCase().includes(q) ||
          entry.description.toLowerCase().includes(q) ||
          entry.text.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DialogTrigger
        render={
          <button className="border-border text-muted-foreground hover:bg-accent flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm sm:w-64">
            <Search className="size-4" />
            Search docs…
          </button>
        }
      />
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogTitle className="sr-only">Search documentation</DialogTitle>
        <div className="border-border border-b p-3">
          <Input
            autoFocus
            placeholder="Search documentation…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() && results.length === 0 && (
            <p className="text-muted-foreground p-4 text-center text-sm">
              No results for &ldquo;{query}&rdquo;.
            </p>
          )}
          {results.map((result) => (
            <Link
              key={`${result.category}-${result.slug}`}
              href={`/docs/${result.category}/${result.slug}`}
              onClick={() => setOpen(false)}
              className="hover:bg-accent block rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-foreground text-sm font-medium">
                  {result.title}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {DOC_CATEGORY_LABELS[result.category]}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                {result.description}
              </p>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
