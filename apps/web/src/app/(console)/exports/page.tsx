'use client';

import { useEffect, useState } from 'react';
import { downloadCsv, getSelectedCustomerId, gql } from '@/lib/api';

interface SiteOption {
  slug: string;
  name: string;
}

const QUERY = `query ExportOptions($customerId: ID) {
  sites(customerId: $customerId) { slug name }
  dataWindow { anchor monthStart }
}`;

export default function ExportsPage() {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [site, setSite] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ sites: SiteOption[]; dataWindow: { anchor: string; monthStart: string } }>(QUERY, {
      customerId: getSelectedCustomerId(),
    })
      .then((data) => {
        setSites(data.sites);
        setFrom(data.dataWindow.monthStart);
        setTo(data.dataWindow.anchor);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleDownload(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await downloadCsv({ site: site || undefined, from, to });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">CSV Export</h1>
        <p className="mt-1 text-sm text-slate-500">
          Download daily generation, revenue and savings figures.
        </p>
      </div>

      <form
        onSubmit={handleDownload}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="site">
            Site
          </label>
          <select
            id="site"
            value={site}
            onChange={(event) => setSite(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="">All sites</option>
            {sites.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="from">
              From
            </label>
            <input
              id="from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="to">
              To
            </label>
            <input
              id="to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
            />
          </div>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Preparing…' : 'Download CSV'}
        </button>
      </form>
    </div>
  );
}
