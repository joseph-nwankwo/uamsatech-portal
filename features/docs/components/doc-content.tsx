import { AlertTriangle, Info } from "lucide-react";
import { H2, H3, P } from "@/components/ui/typography";
import { CodeBlock } from "@/features/docs/components/code-block";
import type { DocBlock } from "@/features/docs/types";

export function DocContent({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <H2 key={i} className="pt-4 text-xl sm:text-xl">
                {block.text}
              </H2>
            );
          case "h3":
            return (
              <H3 key={i} className="pt-2">
                {block.text}
              </H3>
            );
          case "p":
            return (
              <P key={i} className="text-muted-foreground leading-relaxed">
                {block.text}
              </P>
            );
          case "list":
            return (
              <ul key={i} className="list-disc space-y-2 pl-5">
                {block.items.map((item) => (
                  <li key={item} className="text-muted-foreground text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "code":
            return <CodeBlock key={i} {...block} />;
          case "callout": {
            const Icon = block.tone === "warning" ? AlertTriangle : Info;
            return (
              <div
                key={i}
                className={
                  block.tone === "warning"
                    ? "border-status-warning/30 bg-status-warning/10 flex gap-3 rounded-xl border p-4"
                    : "border-blue-accent/30 bg-blue-accent/10 flex gap-3 rounded-xl border p-4"
                }
              >
                <Icon
                  className={
                    block.tone === "warning"
                      ? "text-status-warning mt-0.5 size-4 shrink-0"
                      : "text-blue-accent mt-0.5 size-4 shrink-0"
                  }
                />
                <p className="text-foreground text-sm">{block.text}</p>
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
