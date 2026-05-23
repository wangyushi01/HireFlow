import { lazy, Suspense } from "react";
import { Spin } from "antd";

const RechartsCharts = lazy(() => import("./RechartsCharts"));

function ChartSkeleton() {
  return (
    <div
      style={{
        height: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafafa",
        borderRadius: 8,
      }}
    >
      <Spin />
    </div>
  );
}

export function FunnelChart({ data }: { data: Array<Record<string, unknown>> }) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <RechartsCharts type="funnel" data={data} />
    </Suspense>
  );
}

export function PieChart({ data }: { data: Array<Record<string, unknown>> }) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <RechartsCharts type="pie" data={data} />
    </Suspense>
  );
}

export function BarChart({ data }: { data: Array<Record<string, unknown>> }) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <RechartsCharts type="bar" data={data} />
    </Suspense>
  );
}

export function LineChart({ data }: { data: Array<Record<string, unknown>> }) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <RechartsCharts type="line" data={data} />
    </Suspense>
  );
}
