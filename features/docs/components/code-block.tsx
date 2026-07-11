"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { highlight } from "@/features/docs/components/highlight";
import type { DocBlock } from "@/features/docs/types";

type CodeBlockProps = Extract<DocBlock, { type: "code" }>;

export function CodeBlock({ language, code, caption }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const tokens = highlight(code, language);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <div className="border-border bg-muted/40 flex items-center justify-between border-b px-4 py-2">
        <span className="text-muted-foreground text-xs font-medium">
          {caption ?? language}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="text-status-good size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code className="font-mono">
          {tokens.map((token, i) => (
            <span key={i} className={token.className}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
