import { formatGBP } from '@metris/shared';

export { formatGBP };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDay(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

export function formatDateRange(from: string, to: string): string {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  if (fromYear === toYear && fromMonth === toMonth) {
    return `${fromDay}–${toDay} ${MONTHS[toMonth - 1]} ${toYear}`;
  }
  return `${fromDay} ${MONTHS[fromMonth - 1]} ${fromYear} – ${toDay} ${MONTHS[toMonth - 1]} ${toYear}`;
}

export function formatKwh(value: number): string {
  return `${Math.round(value).toLocaleString('en-GB')} kWh`;
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
