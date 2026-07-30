/**
 * In-process TTL cache for hot dashboard reads. Entries are scoped to this
 * API instance; a restart clears the cache.
 */
const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Returns { value, cache: 'hit' | 'miss' } so callers can surface cache
 * behaviour in request logs.
 */
async function remember(key, ttlMs, loader) {
  const cached = get(key);
  if (cached !== undefined) return { value: cached, cache: 'hit' };
  const value = await loader();
  set(key, value, ttlMs);
  return { value, cache: 'miss' };
}

module.exports = { get, set, remember };
