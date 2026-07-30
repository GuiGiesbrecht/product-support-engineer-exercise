'use client';

import { useEffect, useState } from 'react';
import { getSelectedCustomerId, gql } from '@/lib/api';
import { formatDateRange } from '@/lib/format';
import RevenueChart from '@/components/RevenueChart';
import RevenueTable, { RevenueRow } from '@/components/RevenueTable';

const QUERY = `query RevenueByDay($customerId: ID) {
  revenueByDay(customerId: $customerId) {
    day
    siteName
    productionKwh
    revenueGbp
    savingsGbp
  }
}`;

export default function RevenuePage() {
  const [rows, setRows] = useState<RevenueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ revenueByDay: RevenueRow[] }>(QUERY, { customerId: getSelectedCustomerId() })
      .then((data) => setRows(data.revenueByDay))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!rows) return <p className="text-sm text-slate-400">Loading…</p>;

  const revenueByDay = new Map<string, number>();
  for (const row of rows) {
    revenueByDay.set(row.day, (revenueByDay.get(row.day) || 0) + row.revenueGbp);
  }
  const chartData = [...revenueByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, revenueGbp]) => ({ day, revenueGbp }));
  const range =
    chartData.length > 0
      ? formatDateRange(chartData[0].day, chartData[chartData.length - 1].day)
      : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Revenue</h1>
        <p className="mt-1 text-sm text-slate-500">Month to date · {range}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-slate-700">Daily revenue</h2>
        <RevenueChart data={chartData} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-slate-700">Daily detail</h2>
        <RevenueTable rows={rows} />
      </div>
    </div>
  );
}
