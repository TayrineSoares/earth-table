const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { renderSubscriptionManageEmail } = require('../src/utils/emailTemplates');

describe('fulfillment switch emails', () => {
  it('pickup→delivery unpaid: Tuesday billing copy', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'fulfillment_delivery',
      firstName: 'Tayrine',
      deliveryLabel: 'Sunday, November 22',
      cutoffLabel: 'Wednesday, November 18 at 5:00 PM ET',
      address: '123 Main St',
      planAlreadyPaid: false,
    });
    assert.match(msg.text, /still unpaid/i);
    assert.match(msg.text, /Tuesday at 9:00 AM ET/);
    assert.doesNotMatch(msg.text, /charged to your card now/i);
  });

  it('pickup→delivery paid: charged now copy', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'fulfillment_delivery',
      firstName: 'Tayrine',
      deliveryLabel: 'Sunday, November 22',
      cutoffLabel: 'Wednesday, November 18 at 5:00 PM ET',
      address: '123 Main St',
      planAlreadyPaid: true,
    });
    assert.match(msg.text, /already charged/i);
    assert.match(msg.text, /charged to your card now/i);
    assert.doesNotMatch(msg.text, /still unpaid/i);
  });

  it('pickup→delivery lists address once (not duplicated as Notes)', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'fulfillment_delivery',
      firstName: 'Tayrine',
      deliveryLabel: 'Sunday, November 22',
      address: '123 Main St',
      planAlreadyPaid: false,
    });
    assert.match(msg.text, /Delivery Address: 123 Main St/);
    assert.doesNotMatch(msg.text, /Notes: 123 Main St/);
  });
});
