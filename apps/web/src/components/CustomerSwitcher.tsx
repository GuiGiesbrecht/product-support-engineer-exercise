'use client';

import { useEffect, useState } from 'react';
import { getSelectedCustomerId, getUser, gql, setSelectedCustomerId } from '@/lib/api';

interface Customer {
  id: string;
  name: string;
}

export default function CustomerSwitcher() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<string>('');
  const user = typeof window !== 'undefined' ? getUser() : null;

  useEffect(() => {
    if (!user) return;
    gql<{ customers: Customer[] }>(`{ customers { id name } }`).then(({ customers: list }) => {
      setCustomers(list);
      const stored = getSelectedCustomerId();
      setSelected(stored && list.some((c) => c.id === stored) ? stored : list[0]?.id || '');
    });
  }, []);

  if (!user) return null;
  if (user.customerId !== null) {
    return <span className="text-sm text-slate-500">{customers[0]?.name || ''}</span>;
  }

  return (
    <select
      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 shadow-sm"
      value={selected}
      onChange={(event) => {
        setSelectedCustomerId(event.target.value);
        window.location.reload();
      }}
    >
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customer.name}
        </option>
      ))}
    </select>
  );
}
