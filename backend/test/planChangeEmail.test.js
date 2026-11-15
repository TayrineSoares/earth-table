const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { renderSubscriptionManageEmail } = require('../src/utils/emailTemplates');

describe('plan change manage emails', () => {
  it('plan_now mentions hello@ for help', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'plan_now',
      firstName: 'Alex',
      mealCount: 15,
      nextMealCount: 15,
      deliveryLabel: 'Sunday, November 16',
    });
    assert.match(msg.text, /hello@earthtableco\.ca/);
    assert.match(msg.html, /hello@earthtableco\.ca/);
    assert.match(msg.text, /Need help\?/);
  });

  it('plan_next mentions hello@ for help', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'plan_next',
      firstName: 'Alex',
      mealCount: 10,
      nextMealCount: 15,
      deliveryLabel: 'Sunday, November 16',
    });
    assert.match(msg.text, /hello@earthtableco\.ca/);
    assert.match(msg.text, /following week/);
    assert.match(msg.text, /Need help\?/);
  });
});
