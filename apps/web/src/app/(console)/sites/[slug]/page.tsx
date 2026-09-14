'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { gql } from '@/lib/api';
import { formatDateRange, formatGBP, formatKwh, formatRate, formatTimestamp } from '@/lib/format';
import KpiTile from '@/components/KpiTile';
import SiteHeader, { SiteInfo } from '@/components/SiteHeader';
import GenerationChart from '@/components/GenerationChart';
import AlertsPanel, { AlertItem } from '@/components/AlertsPanel';

interface SiteDetails extends SiteInfo {
  slug: string;
  assets: {
    id: string;
    type: string;
    name: string;
    serialNumber: string;
    manufacturer: string;
    model: string;
    ratedPowerKw: number | null;
    connector: {
      vendor: string;
      externalId: string;
      lastSeenAt: string | null;
      syncState: string;
    } | null;
  }[];
  openAlerts: AlertItem[];
  dailyKpis: { day: string; productionKwh: number; revenueGbp: number; savingsGbp: number }[];
}

const QUERY = `query SiteOverview($slug: String!) {
  site(slug: $slug) {
    slug
    name
    city
    capacityKwp
    commissionedAt
    status
    activePpa { counterparty ratePerKwh endDate }
    assets {
      id type name serialNumber manufacturer model ratedPowerKw
      connector { vendor externalId lastSeenAt syncState }
    }
    openAlerts { id type severity status message triggeredAt assetName }
    dailyKpis { day productionKwh revenueGbp savingsGbp }
  }
}`;

const SYNC_STYLES: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  error: 'bg-rose-50 text-rose-700 ring-rose-200',
  degraded: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const SYNC_LABELS: Record<string, string> = {
  ok: 'Online',
  error: 'Offline',
  degraded: 'Degraded',
};

export default function SitePage() {
  const params = useParams<{ slug: string }>();
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ site: SiteDetails | null }>(QUERY, { slug: params.slug })
      .then((data) => {
        if (!data.site) setError('Site not found');
        else setSite(data.site);
      })
      .catch((err) => setError(err.message));
  }, [params.slug]);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!site) return <p className="text-sm text-slate-400">Loading…</p>;

  const range =
    site.dailyKpis.length > 0
      ? formatDateRange(site.dailyKpis[0].day, site.dailyKpis[site.dailyKpis.length - 1].day)
      : '';

  const totals = site.dailyKpis.reduce(
    (acc, row) => ({
      productionKwh: acc.productionKwh + row.productionKwh,
      revenueGbp: acc.revenueGbp + row.revenueGbp,
      savingsGbp: acc.savingsGbp + row.savingsGbp,
    }),
    { productionKwh: 0, revenueGbp: 0, savingsGbp: 0 }
  );

  return (
    <div className="space-y-6">
      <SiteHeader site={site} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile label="Generation" value={formatKwh(totals.productionKwh)} hint={range} />
        <KpiTile
          label="Revenue"
          value={formatGBP(totals.revenueGbp)}
          hint={
            site.activePpa
              ? `at ${formatRate(site.activePpa.ratePerKwh)}`
              : 'No PPA agreement covers this period'
          }
          hintTone={site.activePpa ? 'muted' : 'warning'}
        />
        <KpiTile label="Savings" value={formatGBP(totals.savingsGbp)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-slate-700">
          Daily generation (kWh) · {range}
        </h2>
        <GenerationChart data={site.dailyKpis} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium text-slate-700">Assets</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Asset</th>
                <th className="py-2 pr-4 font-medium">Model</th>
                <th className="py-2 pr-4 font-medium">Serial</th>
                <th className="py-2 pr-4 text-right font-medium">Rated</th>
                <th className="py-2 pr-4 font-medium">Last seen</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {site.assets.map((asset) => (
                <tr key={asset.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">
                    <p className="font-medium text-slate-900">{asset.name}</p>
                    <p className="text-xs text-slate-400">{asset.type.replace('_', ' ')}</p>
                  </td>
                  <td className="py-2 pr-4 text-slate-600">
                    {asset.manufacturer} {asset.model}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-500">
                    {asset.serialNumber}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-600">
                    {asset.ratedPowerKw ? `${asset.ratedPowerKw} kW` : '—'}
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-500">
                    {formatTimestamp(asset.connector?.lastSeenAt ?? null)}
                  </td>
                  <td className="py-2">
                    {asset.connector ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                          SYNC_STYLES[asset.connector.syncState] || SYNC_STYLES.degraded
                        }`}
                      >
                        {SYNC_LABELS[asset.connector.syncState] || asset.connector.syncState}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-slate-700">Open alerts</h2>
          <AlertsPanel alerts={site.openAlerts} />
        </div>
      </div>
    </div>
  );
}
