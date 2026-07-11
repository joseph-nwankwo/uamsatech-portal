const integrations = [
  "OpenAI",
  "Claude",
  "Gemini",
  "Stripe",
  "Paystack",
  "Flutterwave",
  "Microsoft 365",
  "Google Workspace",
  "Moodle",
  "Canvas",
];

export function Integrations() {
  return (
    <section
      id="integrations"
      className="border-border/60 bg-muted/40 border-y"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-muted-foreground text-center text-sm font-medium tracking-wider uppercase">
          Integrates with the tools you already use
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {integrations.map((name) => (
            <span
              key={name}
              className="text-muted-foreground/80 text-sm font-semibold sm:text-base"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
