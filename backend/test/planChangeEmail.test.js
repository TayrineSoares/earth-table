const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { renderSubscriptionManageEmail } = require('../src/utils/emailTemplates');

describe('plan change manage emails', () => {
  it('plan_now shows previous and new plan plus meals', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'plan_now',
      firstName: 'Alex',
      mealCount: 15,
      oldMealCount: 10,
      nextMealCount: 15,
      deliveryLabel: 'Sunday, November 16',
      meals: [
        { slug: 'Harvest Bowl', quantity: 8 },
        { slug: 'Citrus Salad', quantity: 7 },
      ],
      addons: [{ slug: 'Green Smoothie', quantity: 1 }],
    });
    assert.match(msg.text, /hello@earthtableco\.ca/);
    assert.match(msg.html, /hello@earthtableco\.ca/);
    assert.match(msg.text, /Need help\?/);
    assert.match(msg.text, /Previous plan: .*10/);
    assert.match(msg.text, /New plan: .*15/);
    assert.match(msg.html, /Previous plan/);
    assert.match(msg.html, /New plan/);
    assert.match(msg.text, /Harvest Bowl x 8/);
    assert.match(msg.text, /Green Smoothie x 1/);
    assert.match(msg.html, />Meals</);
  });

  it('plan_next shows previous and new plan plus meals', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'plan_next',
      firstName: 'Alex',
      mealCount: 10,
      oldMealCount: 10,
      nextMealCount: 15,
      deliveryLabel: 'Sunday, November 16',
      meals: [{ slug: 'Herb Chicken Plate', quantity: 15 }],
      addons: [],
    });
    assert.match(msg.text, /hello@earthtableco\.ca/);
    assert.match(msg.text, /following week/);
    assert.match(msg.text, /Need help\?/);
    assert.match(msg.text, /Previous plan: .*10/);
    assert.match(msg.text, /New plan: .*15/);
    assert.match(msg.text, /Herb Chicken Plate x 15/);
    assert.match(msg.text, /None this week\./);
  });
});
