const { OFFLINE_THRESHOLD_HOURS } = require('./constants');

/**
 * An asset is considered offline when its connector has not checked in within
 * the offline threshold. `referenceTime` is injected so that evaluation is
 * deterministic in jobs and testable in isolation.
 */
function isOffline(lastSeenAt, referenceTime, thresholdHours = OFFLINE_THRESHOLD_HOURS) {
  if (!lastSeenAt) return true;
  const elapsedMs = new Date(referenceTime).getTime() - new Date(lastSeenAt).getTime();
  return elapsedMs > thresholdHours * 60 * 60 * 1000;
}

module.exports = { isOffline };
