/**
 * Reading dates are civil dates (YYYY-MM-DD) — connectors deliver one energy
 * summary per asset per day, so date arithmetic here is string-based on ISO
 * dates and never passes through a timezone conversion.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    throw new Error(`Expected an ISO date (YYYY-MM-DD), got: ${value}`);
  }
  return value;
}

function monthToDateRange(anchorDate) {
  assertIsoDate(anchorDate);
  return { from: `${anchorDate.slice(0, 8)}01`, to: anchorDate };
}

function addDays(isoDate, days) {
  assertIsoDate(isoDate);
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function eachDay(from, to) {
  assertIsoDate(from);
  assertIsoDate(to);
  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

module.exports = { assertIsoDate, monthToDateRange, addDays, eachDay };
