"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  signups: {
    label: "New signups",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

// Unlike the Phase 2 design-system demo (components/charts/signups-bar-chart.tsx,
// bound to hardcoded illustrative numbers), this takes real, DB-computed
// data as a prop — the first non-demo use of the Chart primitive.
export function SignupsChart({
  data,
}: {
  data: { day: string; signups: number }[];
}) {
  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={data} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="signups"
          fill="var(--color-signups)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ChartContainer>
  );
}
