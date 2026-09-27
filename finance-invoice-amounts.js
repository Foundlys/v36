'use strict';

// Decimal quantities and user-supplied tax rates use exact rational arithmetic.
// Round each non-negative line half-up to a minor unit; never multiply money
// using binary floats. This calculates inputs, not statutory tax correctness.
function invalid(message) {
  throw Object.assign(Error(message), {code: 'finance_amount_invalid', statusCode: 422});
}
function ratio(value) {
  if (!['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value))) invalid('Ongeldig decimaal bedrag');
  const raw = String(value).trim();
  const parts = raw.length <= 80 && /^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(raw);
  if (!parts) invalid('Ongeldig decimaal bedrag');
  const exponent = Number(parts[3] || 0) - (parts[2] || '').length;
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 400) invalid('Decimaal bedrag valt buiten het ondersteunde bereik');
  const numerator = BigInt(parts[1] + (parts[2] || ''));
  const result = exponent >= 0 ? [numerator * 10n ** BigInt(exponent), 1n] : [numerator, 10n ** BigInt(-exponent)];
  if (typeof value === 'string') {
    const represented = ratio(Number(value));
    if (result[0] * represented[1] !== represented[0] * result[1]) invalid('De decimale invoer kan niet exact als geregistreerd aantal worden bewaard');
  }
  return result;
}
function integer(value) {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) invalid('Bedrag valt buiten het exacte bedragbereik');
  return Number(value);
}
function amounts(quantity, unitPrice, vatRate) {
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) invalid('Prijs moet een positief of nul geheel aantal honderdsten zijn');
  const [qn, qd] = ratio(quantity), [vn, vd] = ratio(vatRate);
  if (qn <= 0n || vn > 100n * vd) invalid('Aantal of belastingpercentage is ongeldig');
  const round = (n, d) => (n * 2n + d) / (d * 2n);
  const net = round(qn * BigInt(unitPrice), qd), vat = round(net * vn, vd * 100n);
  return {net_cents: integer(net), vat_cents: integer(vat), gross_cents: integer(net + vat)};
}
module.exports = {amounts};
