const { Router } = require('express');
const db = require('../db/knex');
const { isStaff, resolveCustomerId } = require('../lib/auth');
const { buildCsv } = require('../services/exportService');
const { getDataAnchor } = require('../services/kpiService');
const { monthToDateRange } = require('@metris/shared');

const router = Router();

/**
 * GET /export/csv?site=<slug>&customerId=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Without a site the export covers every site of the customer in scope, which
 * for staff is the one selected in the console switcher.
 * Without a range it defaults to month-to-date of the latest reading.
 */
router.get('/csv', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  const { site: slug, customerId } = req.query;
  let siteIds;
  let scopedCustomerId = null;
  let filenamePart = 'portfolio';

  if (slug) {
    const site = await db('sites').where({ slug }).first();
    if (!site || (!isStaff(req.user) && site.customer_id !== req.user.customer_id)) {
      return res.status(404).json({ error: 'Site not found' });
    }
    siteIds = [site.id];
    filenamePart = site.slug;
  } else {
    scopedCustomerId = await resolveCustomerId(req.user, customerId);
    const rows = await db('sites').where({ customer_id: scopedCustomerId }).select('id');
    siteIds = rows.map((row) => row.id);
  }

  let { from, to } = req.query;
  if (!from || !to) {
    const anchor = await getDataAnchor();
    ({ from, to } = monthToDateRange(anchor));
  }

  try {
    const csv = await buildCsv(siteIds, from, to);
    res.locals.logMetadata = { site: slug || 'all', customerId: scopedCustomerId, from, to };
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="metris-export-${filenamePart}-${from}-${to}.csv"`
    );
    return res.send(csv);
  } catch (err) {
    res.locals.errorMessage = err.message;
    return res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
