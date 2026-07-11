"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { signupsData } from "@/components/charts/chart-data";

const chartConfig = {
  signups: {
    label: "New signups",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function SignupsBarChart() {
  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={signupsData} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="signups"
          fill="var(--color-signups)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ChartContainer>
  );
}
