const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { renderSubscriptionManageEmail } = require('../src/utils/emailTemplates');

describe('plan change manage emails', () => {
  it('plan_now mentions the move in copy and shows fulfillment plus meals', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'plan_now',
      firstName: 'Alex',
      mealCount: 15,
      oldMealCount: 10,
      nextMealCount: 15,
      deliveryLabel: 'Sunday, November 16',
      delivery: true,
      specialNote: 'Address:\n12 Main St\n\nNotes:\nleave at door',
      meals: [
        { slug: 'Harvest Bowl', quantity: 8 },
        { slug: 'Citrus Salad', quantity: 7 },
      ],
      addons: [{ slug: 'Green Smoothie', quantity: 1 }],
    });
    assert.match(msg.text, /hello@earthtableco\.ca/);
    assert.match(msg.html, /hello@earthtableco\.ca/);
    assert.match(msg.text, /Questions\? Email us at hello@earthtableco\.ca/);
    assert.match(msg.text, /moving from a 10 meals a week to a 15 meals a week/);
    // Applied change: intro + meals only — no duplicate "New plan" row.
    assert.doesNotMatch(msg.text, /New plan:/);
    assert.doesNotMatch(msg.text, /Previous plan:/);
    assert.doesNotMatch(msg.html, /Previous plan/);
    assert.match(msg.text, /Next box:/);
    assert.match(msg.text, /Address: 12 Main St/);
    assert.match(msg.text, /Notes: leave at door/);
    assert.match(msg.text, /Harvest Bowl x 8/);
    assert.match(msg.text, /Green Smoothie x 1/);
    assert.match(msg.html, />Meals</);
  });

  it('plan_next uses next-week heading and shows new plan plus meals', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'plan_next',
      firstName: 'Alex',
      mealCount: 10,
      oldMealCount: 10,
      nextMealCount: 15,
      deliveryLabel: 'Sunday, November 16',
      boxDeliveryLabel: 'Sunday, November 23',
      delivery: true,
      specialNote: 'Address:\n12 Main St\n\nNotes:\ngate',
      meals: [{ slug: 'Herb Chicken Plate', quantity: 15 }],
      addons: [],
    });
    assert.match(msg.text, /hello@earthtableco\.ca/);
    assert.match(msg.text, /Your plan changes starting next week, Alex/);
    assert.match(msg.text, /following week/);
    assert.match(msg.text, /Questions\? Email us at hello@earthtableco\.ca/);
    assert.match(msg.text, /moving from a 10 meals a week to a 15 meals a week/);
    assert.match(msg.text, /New plan: .*15/);
    assert.doesNotMatch(msg.text, /Previous plan:/);
    assert.match(msg.text, /Herb Chicken Plate x 15/);
    assert.match(msg.text, /None this week\./);
    // Intro keeps this Sunday; Next box uses the following week label.
    assert.match(msg.text, /This Sunday, November 16 stays as-is/i);
    assert.match(msg.text, /Next box: Delivery — Sunday, November 23/);
    assert.doesNotMatch(msg.text, /Next box: Delivery — Sunday, November 16/);
  });
});
