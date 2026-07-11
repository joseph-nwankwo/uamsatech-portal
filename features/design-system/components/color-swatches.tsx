function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="border-border h-14 w-full rounded-lg border"
        style={{ background: `var(${varName})` }}
      />
      <div>
        <p className="text-foreground text-xs font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">{varName}</p>
      </div>
    </div>
  );
}

const brand = [
  { name: "Navy (primary)", varName: "--brand-navy" },
  { name: "Gold (secondary)", varName: "--brand-gold" },
  { name: "Blue (accent)", varName: "--brand-blue" },
];

const semantic = [
  { name: "Primary", varName: "--primary" },
  { name: "Secondary", varName: "--secondary" },
  { name: "Accent", varName: "--accent" },
  { name: "Muted", varName: "--muted" },
  { name: "Destructive", varName: "--destructive" },
  { name: "Border", varName: "--border" },
];

const categorical = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
  name: `Chart ${n}`,
  varName: `--chart-${n}`,
}));

const status = [
  { name: "Good", varName: "--status-good" },
  { name: "Warning", varName: "--status-warning" },
  { name: "Serious", varName: "--status-serious" },
  { name: "Critical", varName: "--status-critical" },
];

export function ColorSwatches() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-foreground mb-3 text-sm font-medium">Brand</p>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
          {brand.map((s) => (
            <Swatch key={s.varName} {...s} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-foreground mb-3 text-sm font-medium">Semantic</p>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {semantic.map((s) => (
            <Swatch key={s.varName} {...s} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-foreground mb-3 text-sm font-medium">
          Chart categorical (validated, brand blue substituted in slot 1)
        </p>
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
          {categorical.map((s) => (
            <Swatch key={s.varName} {...s} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-foreground mb-3 text-sm font-medium">
          Status (fixed, never themed)
        </p>
        <div className="grid grid-cols-4 gap-4">
          {status.map((s) => (
            <Swatch key={s.varName} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}
