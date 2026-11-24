const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { renderOwnerSubscriptionEventEmail } = require('../src/utils/emailTemplates');

describe('owner manage event emails', () => {
  it('pause_now names the customer and skipped Sunday', () => {
    const msg = renderOwnerSubscriptionEventEmail({
      kind: 'pause_now',
      customerName: 'Tayrine Soares',
      email: 'tayrine@email.com',
      mealCount: 10,
      deliveryLabel: 'Sunday, November 22',
    });
    assert.match(msg.subject, /Paused — Tayrine Soares/);
    assert.match(msg.text, /will not go out/);
    assert.match(msg.text, /tayrine@email\.com/);
  });

  it('resume lists meals and add-ons', () => {
    const msg = renderOwnerSubscriptionEventEmail({
      kind: 'resume',
      customerName: 'Tayrine Soares',
      email: 'tayrine@email.com',
      mealCount: 10,
      deliveryLabel: 'Sunday, November 22',
      meals: [{ slug: 'Harvest Bowl', quantity: 10 }],
      addons: [{ slug: 'Green Smoothie', quantity: 1 }],
    });
    assert.match(msg.subject, /Resumed — Tayrine Soares/);
    assert.match(msg.text, /Harvest Bowl x 10/);
    assert.match(msg.text, /Green Smoothie x 1/);
  });

  it('resume notes when the box was charged', () => {
    const msg = renderOwnerSubscriptionEventEmail({
      kind: 'resume',
      customerName: 'Tayrine Soares',
      email: 'tayrine@email.com',
      mealCount: 15,
      deliveryLabel: 'Sunday, November 22',
      charged: true,
      chargedCents: 30510,
      meals: [],
      addons: [],
    });
    assert.match(msg.text, /Charged \$305\.10 \(incl\. tax\) for Sunday, November 22/);
  });

  it('plan_now shows the move, plan row, and fulfillment — not a duplicate New plan', () => {
    const msg = renderOwnerSubscriptionEventEmail({
      kind: 'plan_now',
      customerName: 'Alex Kim',
      email: 'alex@email.com',
      mealCount: 15,
      oldMealCount: 10,
      nextMealCount: 15,
      deliveryLabel: 'Sunday, November 22',
      delivery: true,
      specialNote: 'Address:\n12 Main St\n\nNotes:\ngate 4',
      meals: [{ slug: 'Citrus Salad', quantity: 15 }],
      addons: [],
    });
    assert.match(msg.subject, /Plan changed — Alex Kim/);
    assert.match(msg.text, /10 meals a week to a 15 meals a week/);
    assert.match(msg.text, /Plan: 15 meals a week/);
    assert.doesNotMatch(msg.text, /New plan:/);
    assert.match(msg.text, /Next box:/);
    assert.match(msg.text, /Address: 12 Main St/);
    assert.match(msg.text, /Citrus Salad x 15/);
  });
});
