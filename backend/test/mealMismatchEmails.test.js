const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  renderSubscriptionMealMismatchEmail,
  renderOwnerMealMismatchEmail,
} = require('../src/utils/emailTemplates');

const meals = [
  { name: 'Herb Chicken', quantity: 4 },
  { name: 'Salmon Bowl', quantity: 6 },
];

describe('renderSubscriptionMealMismatchEmail', () => {
  it('short + billed asks customer to email hello@ with extra meals', () => {
    const msg = renderSubscriptionMealMismatchEmail({
      firstName: 'Justina',
      mealCount: 15,
      selectedCount: 10,
      deliveryLabel: 'Sunday, November 16',
      meals,
      billed: true,
    });
    assert.match(msg.subject, /only 10 of 15/);
    assert.match(msg.text, /already charged/);
    assert.match(msg.text, /5 extra meals/);
    assert.match(msg.text, /Email hello@earthtableco\.ca/);
    assert.match(msg.html, /My Subscriptions/);
    assert.ok(msg.html.length > 500);
  });

  it('over + billed asks which meals to keep (downgrade path)', () => {
    const msg = renderSubscriptionMealMismatchEmail({
      firstName: 'Alex',
      mealCount: 10,
      selectedCount: 15,
      deliveryLabel: 'Sunday, November 16',
      meals,
      billed: true,
    });
    assert.match(msg.subject, /15 meals locked on a 10-meal plan/);
    assert.match(msg.text, /already charged/);
    assert.match(msg.text, /which 10 meals to keep/);
  });

  it('unbilled short does not claim already charged', () => {
    const msg = renderSubscriptionMealMismatchEmail({
      firstName: 'Sam',
      mealCount: 8,
      selectedCount: 5,
      deliveryLabel: 'Sunday, November 23',
      meals,
      billed: false,
    });
    assert.doesNotMatch(msg.text, /already charged/);
    assert.match(msg.text, /You're on 8 meals a week/);
    assert.match(msg.text, /3 extra meals/);
  });
});

describe('renderOwnerMealMismatchEmail', () => {
  it('short owner notice includes contact + order', () => {
    const msg = renderOwnerMealMismatchEmail({
      customerName: 'Justina Cutrara',
      email: 'justina@example.com',
      phone: '4165551212',
      mealCount: 15,
      selectedCount: 10,
      deliveryLabel: 'Sunday, November 16',
      orderId: 396,
      meals,
      billed: true,
    });
    assert.match(msg.subject, /Justina Cutrara: 10 of 15/);
    assert.match(msg.text, /was charged for it/);
    assert.match(msg.text, /justina@example.com/);
    assert.match(msg.text, /#396/);
    assert.match(msg.text, /Ask them for the 5 extra/);
  });

  it('over owner notice asks which to keep', () => {
    const msg = renderOwnerMealMismatchEmail({
      customerName: 'Alex',
      email: 'a@example.com',
      mealCount: 10,
      selectedCount: 15,
      deliveryLabel: 'Sunday, November 16',
      meals,
      billed: true,
    });
    assert.match(msg.subject, /15 on 10-meal plan/);
    assert.match(msg.text, /Confirm which 10 to keep/);
  });

  it('unbilled owner notice omits charged wording', () => {
    const msg = renderOwnerMealMismatchEmail({
      customerName: 'Sam',
      email: 's@example.com',
      mealCount: 15,
      selectedCount: 0,
      deliveryLabel: 'Sunday, November 23',
      meals: [],
      billed: false,
    });
    assert.doesNotMatch(msg.text, /was charged for it/);
    assert.match(msg.text, /locked with only 0/);
  });
});
