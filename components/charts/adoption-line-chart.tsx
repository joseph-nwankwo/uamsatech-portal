"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { adoptionData } from "@/components/charts/chart-data";

const chartConfig = {
  LectureSuite: {
    label: "LectureSuite",
    color: "var(--chart-1)",
  },
  ScholarSuite: {
    label: "ScholarSuite",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function AdoptionLineChart() {
  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <LineChart data={adoptionData} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="LectureSuite"
          type="monotone"
          stroke="var(--color-LectureSuite)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-LectureSuite)", strokeWidth: 0 }}
        />
        <Line
          dataKey="ScholarSuite"
          type="monotone"
          stroke="var(--color-ScholarSuite)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-ScholarSuite)", strokeWidth: 0 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
