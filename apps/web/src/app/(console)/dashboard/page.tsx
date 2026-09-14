'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { eachDay } from '@metris/shared';
import { getSelectedCustomerId, gql } from '@/lib/api';
import { formatDateRange, formatDay, formatGBP, formatKwh, formatRate } from '@/lib/format';
import KpiTile from '@/components/KpiTile';
import GenerationChart from '@/components/GenerationChart';

interface Dashboard {
  periodStart: string;
  periodEnd: string;
  productionKwh: number;
  revenueGbp: number;
  savingsGbp: number;
  openAlerts: number;
  freshness: { throughDay: string | null; daysBehind: number | null };
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
    ppaRatePerKwh: number | null;
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
    freshness { throughDay daysBehind }
    daily { day productionKwh revenueGbp }
    sites { id slug name city capacityKwp productionKwh revenueGbp savingsGbp ppaRatePerKwh }
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

  const { throughDay, daysBehind } = dashboard.freshness;
  const isBehind = throughDay !== null && daysBehind !== null && daysBehind > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Month to date · {formatDateRange(dashboard.periodStart, dashboard.periodEnd)}
          </p>
          {throughDay && !isBehind ? (
            <p className="mt-1 text-xs text-slate-400">
              Figures updated through {formatDay(throughDay)}
            </p>
          ) : null}
        </div>
      </div>

      {isBehind ? (
        <div className="rounded-xl bg-amber-50 px-5 py-4 text-sm text-amber-800 ring-1 ring-amber-200">
          <p className="font-medium">
            These figures are updated through {formatDay(throughDay)}, {daysBehind}{' '}
            {daysBehind === 1 ? 'day' : 'days'} behind the latest readings.
          </p>
          <p className="mt-1 text-amber-700">
            Revenue, Site Overview and CSV exports are calculated from the readings and reflect the
            latest data.
          </p>
        </div>
      ) : null}

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Site</th>
                <th className="py-2 pr-4 font-medium">City</th>
                <th className="py-2 pr-4 text-right font-medium">Capacity</th>
                <th className="py-2 pr-4 text-right font-medium">Generation</th>
                <th className="py-2 pr-4 text-right font-medium">Rate</th>
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
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-600">
                    {site.ppaRatePerKwh === null ? (
                      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                        No agreement
                      </span>
                    ) : (
                      formatRate(site.ppaRatePerKwh)
                    )}
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
    </div>
  );
}
