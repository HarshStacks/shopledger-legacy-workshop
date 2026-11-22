'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

function recordInMemoryOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 1, orders: [] };

  const order = orders.add(db, {
    date: '2026-01-02',
    customer: 'In-memory characterization customer',
    items,
    coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });

  return { order, totals };
}

test('invoice applies the HSN slab and matches the recorded order', function () {
  // This matches the line shape assembled by routes/orders.js: HSN is present,
  // but gstRate is not stored on the order line.
  const items = [{ id: 7, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 2 }];
  const { order, totals } = recordInMemoryOrder(items, '');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(totals.subtotal, 200);
  assert.equal(totals.tax, 10);
  assert.equal(totals.total, 210);
  assert.equal(order.tax, 10);
  assert.equal(order.total, 210);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 5);
  assert.equal(figures.sgst, 5);
  assert.equal(figures.total, order.total);
});

test('invoice applies the SAVE10 cap and matches the recorded tax and total', function () {
  const items = [{ id: 8, sku: 'TEA-1', name: 'Tea', hsn: '0902', price: 2000, qty: 1 }];
  const { order, totals } = recordInMemoryOrder(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(totals.subtotal, 2000);
  assert.equal(totals.discount, 150);
  assert.equal(totals.tax, 333);
  assert.equal(totals.total, 2183);
  assert.equal(order.total, 2183);

  assert.equal(figures.rows[0].gstPercent, 18);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 166.5);
  assert.equal(figures.sgst, 166.5);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.total, order.total);
});
