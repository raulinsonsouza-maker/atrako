"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const primary = "#14b8a6";
const primaryDark = "#0d9488";

export function DashboardCharts({
  bySource,
  byStage,
}: {
  bySource: { name: string; total: number }[];
  byStage: { name: string; total: number }[];
}) {
  const chartData = (arr: { name: string; total: number }[]) =>
    arr?.length ? arr : [{ name: "-", total: 0 }];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-sm border border-neutral-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-neutral-900">Por origem</h3>
        <div className="h-64 min-h-[200px] w-full" style={{ position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <BarChart data={chartData(bySource)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill={primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-sm border border-neutral-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-neutral-900">Por estágio</h3>
        <div className="h-64 min-h-[200px] w-full" style={{ position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <BarChart data={chartData(byStage)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill={primaryDark} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
