'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSelectedCustomerId, getToken, getUser, gql, logout } from '@/lib/api';
import CustomerSwitcher from '@/components/CustomerSwitcher';

interface SiteLink {
  slug: string;
  name: string;
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/revenue', label: 'Revenue' },
  { href: '/exports', label: 'CSV Export' },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [sites, setSites] = useState<SiteLink[]>([]);
  const user = typeof window !== 'undefined' ? getUser() : null;

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setReady(true);
    const customerId = getSelectedCustomerId();
    gql<{ sites: SiteLink[] }>(
      `query SiteNav($customerId: ID) { sites(customerId: $customerId) { slug name } }`,
      { customerId }
    )
      .then((data) => setSites(data.sites))
      .catch(() => setSites([]));
  }, []);

  if (!ready) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-300">
        <div className="px-5 py-5">
          <p className="text-lg font-semibold text-white">
            <span className="text-amber-400">◉</span> Metris
          </p>
          <p className="text-xs text-slate-500">Solar monitoring</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-2.5 py-2 text-sm ${
                pathname === item.href
                  ? 'bg-slate-800 font-medium text-white'
                  : 'hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <p className="px-2.5 pb-1 pt-5 text-xs font-medium uppercase tracking-wide text-slate-500">
            Sites
          </p>
          {sites.map((site) => (
            <Link
              key={site.slug}
              href={`/sites/${site.slug}`}
              className={`block rounded-md px-2.5 py-1.5 text-sm ${
                pathname === `/sites/${site.slug}`
                  ? 'bg-slate-800 font-medium text-white'
                  : 'hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              {site.name}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4 text-xs">
          <p className="truncate text-slate-400">{user?.email}</p>
          <button
            className="mt-1 text-slate-500 hover:text-white"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-3">
          <CustomerSwitcher />
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
