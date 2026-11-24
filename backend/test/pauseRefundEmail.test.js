const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  renderSubscriptionManageEmail,
  renderOwnerSubscriptionEventEmail,
} = require('../src/utils/emailTemplates');

describe('pause / plan / fulfillment refund emails', () => {
  it('pause_now with refund mentions the refund', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'pause_now',
      firstName: 'Alex',
      deliveryLabel: 'Sunday, November 22',
      refundedCents: 30510,
    });
    assert.match(msg.text, /refunded/i);
    assert.match(msg.text, /will not go out/i);
  });

  it('owner pause_now with refund notes the amount', () => {
    const msg = renderOwnerSubscriptionEventEmail({
      kind: 'pause_now',
      customerName: 'Alex Kim',
      email: 'alex@email.com',
      mealCount: 10,
      deliveryLabel: 'Sunday, November 22',
      refundedCents: 30510,
    });
    assert.match(msg.text, /refunded/i);
    assert.match(msg.text, /\$305\.10/);
  });

  it('plan_now with downgrade refund mentions the difference', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'plan_now',
      firstName: 'Alex',
      mealCount: 10,
      oldMealCount: 15,
      nextMealCount: 10,
      deliveryLabel: 'Sunday, November 22',
      refundedCents: 10170,
      meals: [],
      addons: [],
    });
    assert.match(msg.text, /A refund of \$101\.70 \(including tax\) has been issued to your card/i);
    assert.match(msg.text, /Questions\? Email us at hello@earthtableco\.ca/);
  });

  it('owner plan_now with downgrade refund says a refund has been issued', () => {
    const msg = renderOwnerSubscriptionEventEmail({
      kind: 'plan_now',
      customerName: 'Alex Kim',
      email: 'alex@email.com',
      mealCount: 10,
      oldMealCount: 15,
      nextMealCount: 10,
      deliveryLabel: 'Sunday, November 22',
      refundedCents: 10170,
      meals: [],
      addons: [],
    });
    assert.match(msg.text, /A refund of \$101\.70 \(incl\. tax\) has been issued/i);
  });

  it('fulfillment_pickup paid with refund does not tell them to email hello@ for the fee', () => {
    const msg = renderSubscriptionManageEmail({
      kind: 'fulfillment_pickup',
      firstName: 'Alex',
      deliveryLabel: 'Sunday, November 22',
      planAlreadyPaid: true,
      refundedCents: 1695,
      pickupSlot: '11:00 AM - 1:00 PM',
    });
    assert.match(msg.text, /refunded/i);
    assert.doesNotMatch(msg.text, /email hello@earthtableco\.ca to ask about a refund/i);
  });
});
