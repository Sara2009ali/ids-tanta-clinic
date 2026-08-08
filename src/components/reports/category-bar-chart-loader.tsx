"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * See revenue-chart-loader.tsx for why this is deferred via next/dynamic
 * rather than imported directly.
 */
export const CategoryBarChart = dynamic(() => import("./category-bar-chart").then((mod) => mod.CategoryBarChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
});

export type { CategoryBarChartPoint } from "./category-bar-chart";
