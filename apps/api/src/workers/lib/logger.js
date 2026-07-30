const os = require('os');
const db = require('../../db/knex');

const hostname = `worker-${os.hostname().slice(0, 6)}`;

/**
 * Worker log lines go to stdout for `docker compose logs` and to the
 * worker_logs table for the support console. Persisting a log line must never
 * take a job down.
 */
function log(jobId, level, message, context = {}) {
  console.log(`[${hostname}] [${level}] ${message}`);
  db('worker_logs')
    .insert({
      job_id: jobId,
      worker_hostname: hostname,
      level,
      message,
      context,
    })
    .catch(() => {});
}

module.exports = { log, hostname };
