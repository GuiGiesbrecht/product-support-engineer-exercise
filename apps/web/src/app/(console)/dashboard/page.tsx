'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { eachDay } from '@metris/shared';
import { getSelectedCustomerId, gql } from '@/lib/api';
import { formatDateRange, formatGBP, formatKwh } from '@/lib/format';
import KpiTile from '@/components/KpiTile';
import GenerationChart from '@/components/GenerationChart';

interface Dashboard {
  periodStart: string;
  periodEnd: string;
  productionKwh: number;
  revenueGbp: number;
  savingsGbp: number;
  openAlerts: number;
  daily: { day: string; productionKwh: number; revenueGbp: number }[];
  sites: {
    id: string;
    slug: string;
    name: string;
    city: string;
    capacityKwp: number;
    productionKwh: number;
    revenueGbp: number;
    savingsGbp: number;
  }[];
}

const QUERY = `query DashboardKpis($customerId: ID) {
  dashboard(customerId: $customerId) {
    periodStart
    periodEnd
    productionKwh
    revenueGbp
    savingsGbp
    openAlerts
    daily { day productionKwh revenueGbp }
    sites { id slug name city capacityKwp productionKwh revenueGbp savingsGbp }
  }
}`;

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ dashboard: Dashboard }>(QUERY, { customerId: getSelectedCustomerId() })
      .then((data) => setDashboard(data.dashboard))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!dashboard) return <p className="text-sm text-slate-400">Loading…</p>;

  const byDay = new Map(dashboard.daily.map((point) => [point.day, point.productionKwh]));
  const chartData = eachDay(dashboard.periodStart, dashboard.periodEnd).map((day: string) => ({
    day,
    productionKwh: byDay.get(day) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Month to date · {formatDateRange(dashboard.periodStart, dashboard.periodEnd)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label="Generation" value={formatKwh(dashboard.productionKwh)} />
        <KpiTile label="Revenue" value={formatGBP(dashboard.revenueGbp, { decimals: 0 })} />
        <KpiTile label="Savings" value={formatGBP(dashboard.savingsGbp, { decimals: 0 })} />
        <KpiTile label="Open alerts" value={String(dashboard.openAlerts)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-slate-700">Daily generation (kWh)</h2>
        <GenerationChart data={chartData} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-slate-700">Sites</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4 font-medium">Site</th>
              <th className="py-2 pr-4 font-medium">City</th>
              <th className="py-2 pr-4 text-right font-medium">Capacity</th>
              <th className="py-2 pr-4 text-right font-medium">Generation</th>
              <th className="py-2 pr-4 text-right font-medium">Revenue</th>
              <th className="py-2 text-right font-medium">Savings</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.sites.map((site) => (
              <tr key={site.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">
                  <Link
                    href={`/sites/${site.slug}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {site.name}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-slate-600">{site.city}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-slate-600">
                  {site.capacityKwp.toLocaleString('en-GB')} kWp
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-slate-700">
                  {formatKwh(site.productionKwh)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-slate-700">
                  {formatGBP(site.revenueGbp)}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-700">
                  {formatGBP(site.savingsGbp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
