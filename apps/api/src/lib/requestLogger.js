const db = require('../db/knex');

/**
 * Persists one api_logs row per request. Logging is fire-and-forget: a
 * failure to write a log line must never fail the request itself.
 */
module.exports = function requestLogger(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  const startedAt = process.hrtime.bigint();

  // Read here rather than inside the finish handler. Express strips the mount
  // prefix from req.url while a mounted router handles the request, and the
  // response finishes before that prefix is restored — so req.path at that
  // point reports /login for /auth/login and / for every GraphQL request.
  // originalUrl is never rewritten; the query string is dropped because the
  // column records the endpoint, not the arguments.
  const path = req.originalUrl.split('?')[0];

  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    const metadata = { ...(res.locals.logMetadata || {}) };
    db('api_logs')
      .insert({
        method: req.method,
        path,
        // Set by the GraphQL operation-name plugin, which reads the parsed
        // document. The body field is the fallback for clients that send it.
        operation_name: res.locals.operationName || (req.body && req.body.operationName) || null,
        status_code: res.statusCode,
        duration_ms: durationMs,
        user_id: req.user ? req.user.id : null,
        error: res.locals.errorMessage || null,
        metadata,
      })
      .catch(() => {});
  });

  next();
};
