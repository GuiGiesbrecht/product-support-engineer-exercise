const db = require('../db/knex');

/**
 * Persists one api_logs row per request. Logging is fire-and-forget: a
 * failure to write a log line must never fail the request itself.
 */
module.exports = function requestLogger(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    const metadata = { ...(res.locals.logMetadata || {}) };
    db('api_logs')
      .insert({
        method: req.method,
        path: req.path,
        operation_name: (req.body && req.body.operationName) || null,
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
