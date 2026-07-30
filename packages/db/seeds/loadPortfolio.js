const fs = require('fs');
const path = require('path');

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/portfolio.json'), 'utf8')
);

module.exports = async function loadPortfolio(knex) {
  const customerIds = {};
  for (const customer of fixture.customers) {
    const [row] = await knex('customers')
      .insert({
        name: customer.name,
        billing_email: customer.billing_email,
        created_at: customer.created_at,
      })
      .returning('id');
    customerIds[customer.key] = row.id;
  }

  for (const user of fixture.users) {
    await knex('users').insert({
      customer_id: user.customer_key ? customerIds[user.customer_key] : null,
      email: user.email,
      password_hash: user.password_hash,
      full_name: user.full_name,
      role: user.role,
      last_login_at: user.last_login_at,
    });
  }

  const siteIds = {};
  for (const site of fixture.sites) {
    const [row] = await knex('sites')
      .insert({
        customer_id: customerIds[site.customer_key],
        name: site.name,
        slug: site.slug,
        city: site.city,
        capacity_kwp: site.capacity_kwp,
        commissioned_at: site.commissioned_at,
      })
      .returning('id');
    siteIds[site.slug] = row.id;
  }

  const assetIds = {};
  for (const asset of fixture.assets) {
    const [row] = await knex('assets')
      .insert({
        site_id: siteIds[asset.site],
        type: asset.type,
        name: asset.name,
        serial_number: asset.serial,
        manufacturer: asset.manufacturer,
        model: asset.model,
        rated_power_kw: asset.rated_power_kw,
        installed_at: asset.installed_at,
      })
      .returning('id');
    assetIds[asset.serial] = row.id;
  }

  for (const connector of fixture.connector_assets) {
    await knex('connector_assets').insert({
      asset_id: assetIds[connector.asset_serial],
      connector_vendor: connector.connector_vendor,
      external_id: connector.external_id,
      firmware_version: connector.firmware_version,
      last_seen_at: connector.last_seen_at,
      last_sync_at: connector.last_sync_at,
      sync_state: connector.sync_state,
      config: connector.config,
    });
  }

  for (const price of fixture.prices) {
    await knex('prices').insert({
      site_id: siteIds[price.site],
      price_per_kwh: price.price_per_kwh,
      valid_from: price.valid_from,
      valid_to: price.valid_to,
    });
  }

  for (const agreement of fixture.ppa_agreements) {
    await knex('ppa_agreements').insert({
      site_id: siteIds[agreement.site],
      counterparty: agreement.counterparty,
      rate_per_kwh: agreement.rate_per_kwh,
      start_date: agreement.start_date,
      end_date: agreement.end_date,
      status: agreement.status,
      created_at: agreement.created_at,
    });
  }
};
