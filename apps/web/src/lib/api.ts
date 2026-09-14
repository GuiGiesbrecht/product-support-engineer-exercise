const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface SessionUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  customerId: number | null;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('metris.token');
}

export function getUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('metris.user');
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function getSelectedCustomerId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('metris.customerId');
}

export function setSelectedCustomerId(customerId: string) {
  window.localStorage.setItem('metris.customerId', customerId);
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Login failed');
  }
  const body = await res.json();
  window.localStorage.setItem('metris.token', body.token);
  window.localStorage.setItem('metris.user', JSON.stringify(body.user));
  return body.user;
}

export function logout() {
  window.localStorage.removeItem('metris.token');
  window.localStorage.removeItem('metris.user');
  window.localStorage.removeItem('metris.customerId');
}

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors[0].message);
  }
  return body.data as T;
}

export async function downloadCsv(params: {
  site?: string;
  customerId?: string | null;
  from?: string;
  to?: string;
}) {
  const token = getToken();
  const search = new URLSearchParams();
  if (params.site) search.set('site', params.site);
  if (params.customerId) search.set('customerId', params.customerId);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  const res = await fetch(`${API_URL}/export/csv?${search.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = match ? match[1] : 'metris-export.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
