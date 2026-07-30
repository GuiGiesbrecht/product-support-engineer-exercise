const { siteDailyKpis } = require('./reportingService');

const HEADER = [
  'date',
  'site',
  'production_kwh',
  'consumption_kwh',
  'self_consumed_kwh',
  'revenue_gbp',
  'savings_gbp',
];

function csvField(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatRow(row) {
  return [
    row.day,
    row.siteName,
    row.productionKwh.toFixed(2),
    row.consumptionKwh.toFixed(2),
    row.selfConsumedKwh.toFixed(2),
    row.revenueGbp.toFixed(2),
    row.savingsGbp.toFixed(2),
  ]
    .map(csvField)
    .join(',');
}

/**
 * Builds the daily KPI export for a set of sites. Figures are computed from
 * the readings tables at export time and the file closes with a totals row.
 */
async function buildCsv(siteIds, from, to) {
  const rows = await siteDailyKpis(siteIds, from, to);

  const totals = rows.reduce(
    (acc, row) => ({
      productionKwh: acc.productionKwh + row.productionKwh,
      consumptionKwh: acc.consumptionKwh + row.consumptionKwh,
      selfConsumedKwh: acc.selfConsumedKwh + row.selfConsumedKwh,
      revenueGbp: acc.revenueGbp + row.revenueGbp,
      savingsGbp: acc.savingsGbp + row.savingsGbp,
    }),
    { productionKwh: 0, consumptionKwh: 0, selfConsumedKwh: 0, revenueGbp: 0, savingsGbp: 0 }
  );

  const lines = [HEADER.join(',')];
  for (const row of rows) lines.push(formatRow(row));
  lines.push(
    [
      'TOTAL',
      '',
      totals.productionKwh.toFixed(2),
      totals.consumptionKwh.toFixed(2),
      totals.selfConsumedKwh.toFixed(2),
      totals.revenueGbp.toFixed(2),
      totals.savingsGbp.toFixed(2),
    ].join(',')
  );
  return lines.join('\n') + '\n';
}

module.exports = { buildCsv };
