import { formatTimestamp } from '@/lib/format';

export interface AlertItem {
  id: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  triggeredAt: string;
  assetName?: string | null;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-rose-50 text-rose-700 ring-rose-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
};

export default function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return <p className="text-sm text-slate-500">No open alerts.</p>;
  }
  return (
    <ul className="space-y-3">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
              SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info
            }`}
          >
            {alert.severity}
          </span>
          <div>
            <p className="text-sm text-slate-700">{alert.message}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {alert.type} · triggered {formatTimestamp(alert.triggeredAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
