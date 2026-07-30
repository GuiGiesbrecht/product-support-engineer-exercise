const ASSET_TYPES = ['inverter', 'smart_meter', 'battery', 'weather_station'];

const ALERT_TYPES = {
  ASSET_OFFLINE: 'asset_offline',
  COMMS_DEGRADED: 'comms_degraded',
  UNDERPERFORMANCE: 'underperformance',
};

const OFFLINE_THRESHOLD_HOURS = 6;

module.exports = { ASSET_TYPES, ALERT_TYPES, OFFLINE_THRESHOLD_HOURS };
