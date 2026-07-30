'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDay } from '@/lib/format';

export interface RevenuePoint {
  day: string;
  revenueGbp: number;
}

export default function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const points = data.map((point) => ({ ...point, label: formatDay(point.day) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval={3}
          tick={{ fontSize: 11, fill: '#64748b' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickFormatter={(value: number) => `£${value.toLocaleString('en-GB')}`}
        />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          formatter={(value) => [`£${(value as number).toFixed(2)}`, 'Revenue']}
        />
        <Bar dataKey="revenueGbp" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
