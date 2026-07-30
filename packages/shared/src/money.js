/**
 * All monetary amounts flow through the platform as decimal GBP values.
 * Persisted figures are rounded to the penny at aggregation time, so
 * formatting here must never introduce further rounding drift.
 */

function formatGBP(amount, { decimals = 2 } = {}) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function toPence(gbp) {
  return Math.round(Number(gbp) * 100);
}

function fromPence(pence) {
  return pence / 100;
}

function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

module.exports = { formatGBP, toPence, fromPence, roundMoney };
