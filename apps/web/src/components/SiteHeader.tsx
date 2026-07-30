export interface SiteInfo {
  name: string;
  city: string;
  capacityKwp: number;
  commissionedAt: string;
  status: string;
  activePpa: {
    counterparty: string;
    ratePerKwh: number;
    endDate: string;
  } | null;
}

export default function SiteHeader({ site }: { site: SiteInfo }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{site.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {site.city} · {site.capacityKwp.toLocaleString('en-GB')} kWp · commissioned{' '}
          {site.commissionedAt}
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">PPA</p>
        {site.activePpa ? (
          <p className="mt-1 text-slate-700">
            £{site.activePpa.ratePerKwh.toFixed(4)}/kWh · until {site.activePpa.endDate} ·{' '}
            {site.activePpa.counterparty}
          </p>
        ) : (
          <p className="mt-1 text-slate-500">No active agreement</p>
        )}
      </div>
    </div>
  );
}
