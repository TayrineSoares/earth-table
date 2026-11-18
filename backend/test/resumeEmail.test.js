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

  it('says we charged when charged=true', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'resume',
      firstName: 'Tayrine',
      mealCount: 15,
      deliveryLabel: 'Sunday, November 22',
      charged: true,
      meals: [{ slug: 'Sweet Potato Bowl', quantity: 15 }],
      addons: [],
    });
    assert.match(msg.text, /We charged this box for this Sunday, November 22/);
    assert.doesNotMatch(msg.text, /Next charge is/);
  });

  it('names next Tuesday charge when charged=false', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'resume',
      firstName: 'Tayrine',
      mealCount: 15,
      deliveryLabel: 'Sunday, November 22',
      charged: false,
      meals: [{ slug: 'Sweet Potato Bowl', quantity: 15 }],
      addons: [],
    });
    assert.match(msg.text, /Here's what's set for this Sunday, November 22/);
    assert.match(msg.text, /Next charge is Tuesday at 9:00 AM ET/);
    assert.doesNotMatch(msg.text, /We charged this box/);
  });

  it('calls the editable box next Sunday after lock when followingWeek', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'resume',
      firstName: 'Tayrine',
      mealCount: 15,
      deliveryLabel: 'Sunday, November 29',
      charged: false,
      followingWeek: true,
      meals: [{ slug: 'Sweet Potato Bowl', quantity: 15 }],
      addons: [],
    });
    assert.match(msg.text, /Here's what's set for next Sunday, November 29/);
    assert.doesNotMatch(msg.text, /this Sunday, November 29/);
    assert.match(msg.text, /Next charge is Tuesday at 9:00 AM ET/);
  });
});
