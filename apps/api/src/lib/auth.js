const bcrypt = require('bcryptjs');
const db = require('../db/knex');

/**
 * Session tokens for the internal console. This deployment sits behind the
 * platform VPN, so tokens are opaque references rather than signed JWTs.
 */
function issueToken(user) {
  return Buffer.from(JSON.stringify({ uid: user.id, iat: Date.now() })).toString('base64url');
}

function parseToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    return Number.isInteger(payload.uid) ? payload : null;
  } catch {
    return null;
  }
}

async function login(email, password) {
  const user = await db('users').where({ email }).first();
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  await db('users').where({ id: user.id }).update({ last_login_at: db.fn.now() });
  return user;
}

async function userFromRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const payload = parseToken(header.slice('Bearer '.length));
  if (!payload) return null;
  return db('users').where({ id: payload.uid }).first();
}

function isStaff(user) {
  return user && user.customer_id === null;
}

/**
 * Staff can act on any customer; customer users are always scoped to their own
 * organisation regardless of what they ask for.
 */
function resolveCustomerId(user, requestedCustomerId) {
  if (!isStaff(user)) return user.customer_id;
  return requestedCustomerId ? Number(requestedCustomerId) : null;
}

module.exports = { issueToken, login, userFromRequest, isStaff, resolveCustomerId };
