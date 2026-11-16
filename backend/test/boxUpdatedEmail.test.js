const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { renderSubscriptionUpdatedEmail } = require('../src/utils/emailTemplates');

describe('box updated email', () => {
  it('lists meals and add-ons for this Sunday', () => {
    const msg = renderSubscriptionUpdatedEmail({
      firstName: 'Tayrine',
      mealCount: 10,
      delivery: false,
      deliveryLabel: 'Sunday, November 22',
      pickupSlot: '10:00-13:00',
      appliesTo: 'this_sunday',
      meals: [
        { slug: 'Harvest Bowl', quantity: 4 },
        { slug: 'Citrus Salad', quantity: 6 },
      ],
      addons: [{ slug: 'Green Smoothie', quantity: 2 }],
      notes: 'No nuts',
    });
    assert.match(msg.subject, /updated this Sunday's box/i);
    assert.match(msg.text, /You've updated your box, Tayrine/);
    assert.match(msg.text, /Harvest Bowl x 4/);
    assert.match(msg.text, /Green Smoothie x 2/);
    assert.match(msg.html, /Harvest Bowl x 4/);
  });

  it('says next week when applies_to is next_week', () => {
    const msg = renderSubscriptionUpdatedEmail({
      firstName: 'Alex',
      mealCount: 6,
      deliveryLabel: 'Sunday, November 29',
      appliesTo: 'next_week',
      meals: [{ slug: 'Herb Chicken Plate', quantity: 6 }],
      addons: [],
    });
    assert.match(msg.subject, /next week's box/i);
    assert.match(msg.text, /already locked/);
  });
});
