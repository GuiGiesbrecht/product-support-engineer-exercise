/**
 * PPA agreements apply per reading date: a generation day is billable under
 * the agreement whose [start_date, end_date] window contains it.
 */

function activeAgreementFor(agreements, isoDate) {
  return (
    agreements.find(
      (agreement) =>
        agreement.start_date <= isoDate &&
        isoDate <= agreement.end_date &&
        agreement.status === 'active'
    ) || null
  );
}

module.exports = { activeAgreementFor };
