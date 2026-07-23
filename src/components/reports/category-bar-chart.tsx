"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  chartAxisTick,
  chartTooltipContentStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
} from "@/lib/chart-theme";

export interface CategoryBarChartPoint {
  label: string;
  value: number;
}

/** Generic label/value bar chart — status breakdowns, top-N rankings, etc. Same themed styling as RevenueChart. */
export function CategoryBarChart({
  data,
  valueFormatter = (v: number) => String(v),
}: {
  data: CategoryBarChartPoint[];
  valueFormatter?: (value: number) => string;
}) {
  return (
    <div className="h-64 w-full rounded-xl border border-border p-4 shadow-elevation-low">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={chartAxisTick}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={48}
          />
          <YAxis
            tick={chartAxisTick}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={chartTooltipContentStyle}
            labelStyle={chartTooltipLabelStyle}
            itemStyle={chartTooltipItemStyle}
            formatter={(value) => [valueFormatter(Number(value)), "Count"]}
          />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
