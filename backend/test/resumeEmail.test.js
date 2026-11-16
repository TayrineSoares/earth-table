const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { renderSubscriptionManageEmail } = require('../src/utils/emailTemplates');

describe('resume welcome-back email', () => {
  it('lists selected meals and add-ons', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'resume',
      firstName: 'Tayrine',
      mealCount: 10,
      deliveryLabel: 'Sunday, November 22',
      meals: [
        { slug: 'Harvest Bowl', quantity: 4 },
        { slug: 'Citrus Salad', quantity: 6 },
      ],
      addons: [{ slug: 'Green Smoothie', quantity: 2 }],
    });
    assert.match(msg.subject, /active again/i);
    assert.match(msg.text, /Welcome back, Tayrine/);
    assert.match(msg.text, /Harvest Bowl x 4/);
    assert.match(msg.text, /Citrus Salad x 6/);
    assert.match(msg.text, /Green Smoothie x 2/);
    assert.match(msg.html, /Harvest Bowl x 4/);
    assert.match(msg.html, /Green Smoothie x 2/);
    assert.match(msg.html, />Meals</);
    assert.match(msg.html, />Add-ons</);
  });

  it('shows empty add-ons copy when none selected', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'resume',
      firstName: 'Alex',
      mealCount: 6,
      deliveryLabel: 'Sunday, November 22',
      meals: [{ slug: 'Herb Chicken Plate', quantity: 6 }],
      addons: [],
    });
    assert.match(msg.text, /Herb Chicken Plate x 6/);
    assert.match(msg.text, /None this week\./);
  });
});
