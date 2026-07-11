import {
  ShieldCheck,
  Sparkles,
  Layers,
  Users,
  Gauge,
  Award,
} from "lucide-react";

const values = [
  {
    icon: Sparkles,
    title: "Simplicity",
    description:
      "Software that gets out of the way of teaching, learning, and research.",
  },
  {
    icon: ShieldCheck,
    title: "Reliability",
    description:
      "Built for the academic calendar — no downtime during exams or registration.",
  },
  {
    icon: Layers,
    title: "Innovation",
    description:
      "AI-powered tools that keep institutions ahead, not just up to date.",
  },
  {
    icon: Award,
    title: "Security",
    description:
      "Central authentication, encrypted data, and role-based access by default.",
  },
  {
    icon: Gauge,
    title: "Scalability",
    description: "From a single lecturer to an entire university system.",
  },
  {
    icon: Users,
    title: "User-Centered Design",
    description:
      "Designed with lecturers, registrars, and students, not just for them.",
  },
];

export function Values() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          Built on academic excellence
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">
          Every product in the UAMSATech ecosystem shares the same core values.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {values.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex gap-4">
            <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-5" />
            </div>
            <div>
              <h3 className="text-foreground font-semibold">{title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
