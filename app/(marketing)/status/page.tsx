import type { Metadata } from "next";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { products } from "@/lib/site-config";
import {
  getOpenIncidents,
  getRecentIncidents,
} from "@/features/support/queries";

export const metadata: Metadata = {
  title: "Status",
  description:
    "Current operational status of every UAMSATech product and service.",
  alternates: { canonical: "/status" },
};

// Otherwise this page prerenders once at build time and a new incident
// wouldn't show until the next deploy — the opposite of what a status page
// is for. Revalidate frequently instead of making the whole route dynamic.
export const revalidate = 60;

const services = [
  { name: "auth.uamsatech.com", description: "Central authentication & SSO" },
  { name: "portal.uamsatech.com", description: "Customer portal" },
  ...products.map((p) => ({ name: p.subdomain, description: p.name })),
];

const severityLabel = { MINOR: "Minor", MAJOR: "Major", CRITICAL: "Critical" };
const statusLabel = {
  INVESTIGATING: "Investigating",
  IDENTIFIED: "Identified",
  MONITORING: "Monitoring",
  RESOLVED: "Resolved",
};

export default async function StatusPage() {
  const [openIncidents, recentIncidents] = await Promise.all([
    getOpenIncidents(),
    getRecentIncidents(),
  ]);
  const allOperational = openIncidents.length === 0;

  return (
    <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="relative flex size-3">
          {allOperational && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex size-3 rounded-full ${allOperational ? "bg-emerald-500" : "bg-amber-500"}`}
          />
        </span>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          {allOperational
            ? "All systems operational"
            : "Some systems are experiencing issues"}
        </h1>
      </div>

      {openIncidents.length > 0 && (
        <div className="mt-8 space-y-4">
          {openIncidents.map((incident) => (
            <div
              key={incident.id}
              className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                <p className="text-foreground text-sm font-medium">
                  {incident.title}
                </p>
                <Badge variant="outline">{statusLabel[incident.status]}</Badge>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                {incident.body}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                {incident.service} &middot; {severityLabel[incident.severity]}{" "}
                &middot; started {incident.startedAt.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      <ul className="divide-border border-border mt-10 divide-y rounded-2xl border">
        {services.map((service) => {
          const degraded = openIncidents.some(
            (i) => i.service === service.name
          );
          return (
            <li
              key={service.name}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <p className="text-foreground font-medium">
                  {service.description}
                </p>
                <p className="text-muted-foreground text-sm">{service.name}</p>
              </div>
              {degraded ? (
                <span className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-4" />
                  Degraded
                </span>
              ) : (
                <span className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  Operational
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-12">
        <h2 className="text-foreground text-lg font-semibold">
          Incident history
        </h2>
        {recentIncidents.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No incidents have been recorded.
          </p>
        ) : (
          <ul className="divide-border border-border mt-4 divide-y rounded-2xl border">
            {recentIncidents.map((incident) => (
              <li key={incident.id} className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <p className="text-foreground text-sm font-medium">
                    {incident.title}
                  </p>
                  <Badge variant="outline">
                    {statusLabel[incident.status]}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {incident.service} &middot;{" "}
                  {incident.startedAt.toLocaleDateString()}
                  {incident.resolvedAt &&
                    ` – ${incident.resolvedAt.toLocaleDateString()}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
