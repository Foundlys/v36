'use strict';

const crypto = require('node:crypto');
const journal = ['journal_entries', 'journal_lines'];
const invoice = ['invoices', 'invoice_lines'];
const payment = ['payments', 'invoices', ...journal];
// Preserve the public native methods and their validation. The complete
// business operation, including its nested writes, owns one durable receipt.
// options is the position after context/principal; inputs remain part of the
// request identity even when their properties arrive in a different order.
const operations = Object.freeze({
  createPeriod: {permission: 'finance:write', entities: ['fiscal_periods'], options: 1},
  createAccount: {permission: 'finance:write', entities: ['accounts'], options: 1},
  bootstrapDutchChart: {permission: 'finance:write', entities: ['accounts'], options: 1},
  postJournal: {permission: 'finance:post', entities: journal, options: 1},
  reverseJournal: {permission: 'finance:post', entities: journal, options: 2},
  createInvoice: {permission: 'finance:write', entities: invoice, options: 1},
  approveInvoice: {permission: 'finance:approve', entities: ['invoices'], options: 2},
  postInvoice: {permission: 'finance:post', entities: ['invoices', ...journal], options: 1,
    defaultKey: args => 'invoice-post:' + args[0]},
  createCreditNote: {permission: 'finance:write', entities: invoice, options: 2},
  recordPayment: {permission: 'finance:post', entities: payment, options: 1},
  confirmReconciliation: {permission: 'finance:approve', entities: ['bank_transactions', 'reconciliations', ...payment], options: 1,
    defaultKey: args => 'reconcile:' + args[0]?.bank_transaction_id}
});
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function install(Finance) {
  for (const [operation, contract] of Object.entries(operations)) {
    const native = Finance.prototype[operation];
    Finance.prototype[operation] = function(context, actor, ...args) {
      const {ctx, principal} = this.scope(context, actor);
      if (!principal.permissions.has('*') && !principal.permissions.has(contract.permission)) {
        throw Object.assign(Error('Deze financiële actie is niet toegestaan voor de actieve rol'), {code: 'finance_forbidden', statusCode: 403});
      }
      const options = args[contract.options] || {};
      const key = options.idempotencyKey ?? contract.defaultKey?.(args);
      const identity = args.slice(0, contract.options + 1);
      while (identity.length <= contract.options) identity.push(null);
      const {idempotencyKey, ...boundOptions} = options;
      identity[contract.options] = boundOptions;
      const signature = crypto.createHash('sha256').update(JSON.stringify(canonical({version: 1, operation, args: identity}))).digest('hex');
      return this.idempotent(ctx, principal, key, signature, () => native.call(this, context, actor, ...args), null, contract.entities);
    };
  }
}
module.exports = {install, operations};
