import { formatGBP, formatDay } from '@/lib/format';

export interface RevenueRow {
  day: string;
  siteName: string;
  productionKwh: number;
  revenueGbp: number;
  savingsGbp: number;
}

export default function RevenueTable({ rows }: { rows: RevenueRow[] }) {
  const totals = rows.reduce(
    (acc, row) => ({
      productionKwh: acc.productionKwh + row.productionKwh,
      revenueGbp: acc.revenueGbp + row.revenueGbp,
      savingsGbp: acc.savingsGbp + row.savingsGbp,
    }),
    { productionKwh: 0, revenueGbp: 0, savingsGbp: 0 }
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Site</th>
            <th className="py-2 pr-4 text-right font-medium">Generation (kWh)</th>
            <th className="py-2 pr-4 text-right font-medium">Revenue</th>
            <th className="py-2 text-right font-medium">Savings</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.day}-${row.siteName}`} className="border-b border-slate-100">
              <td className="py-1.5 pr-4 text-slate-600">{formatDay(row.day)}</td>
              <td className="py-1.5 pr-4 text-slate-600">{row.siteName}</td>
              <td className="py-1.5 pr-4 text-right tabular-nums text-slate-700">
                {row.productionKwh.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-1.5 pr-4 text-right tabular-nums text-slate-700">
                {formatGBP(row.revenueGbp)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-slate-700">
                {formatGBP(row.savingsGbp)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-sm font-semibold text-slate-900">
            <td className="py-2 pr-4">Total</td>
            <td className="py-2 pr-4" />
            <td className="py-2 pr-4 text-right tabular-nums">
              {totals.productionKwh.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </td>
            <td className="py-2 pr-4 text-right tabular-nums">{formatGBP(totals.revenueGbp)}</td>
            <td className="py-2 text-right tabular-nums">{formatGBP(totals.savingsGbp)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
