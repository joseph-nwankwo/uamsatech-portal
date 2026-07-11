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
  lecturercraft: {
    label: "LecturerCraft",
    color: "var(--chart-1)",
  },
  scholarcraft: {
    label: "ScholarCraft",
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
          dataKey="lecturercraft"
          type="monotone"
          stroke="var(--color-lecturercraft)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-lecturercraft)", strokeWidth: 0 }}
        />
        <Line
          dataKey="scholarcraft"
          type="monotone"
          stroke="var(--color-scholarcraft)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-scholarcraft)", strokeWidth: 0 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
