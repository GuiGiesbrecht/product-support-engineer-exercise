export default function KpiTile({
  label,
  value,
  hint,
  hintTone = 'muted',
}: {
  label: string;
  value: string;
  hint?: string;
  /** `warning` marks a hint that explains an unexpected value, such as a missing agreement. */
  hintTone?: 'muted' | 'warning';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? (
        <p
          className={`mt-1 text-xs ${
            hintTone === 'warning' ? 'font-medium text-amber-700' : 'text-slate-400'
          }`}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
