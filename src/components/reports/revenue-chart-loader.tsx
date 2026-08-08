"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * `recharts` is a sizeable client bundle that only ever renders below the
 * fold on this one page — deferring it via `next/dynamic({ ssr: false })`
 * keeps it out of the initial JS payload for /reports/revenue. `ssr: false`
 * requires a Client Component boundary (App Router forbids it directly in
 * a Server Component), hence this thin loader module.
 */
export const RevenueChart = dynamic(() => import("./revenue-chart").then((mod) => mod.RevenueChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
});

export type { RevenueChartPoint } from "./revenue-chart";
