const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { previewNextSundayCycle } = require('../src/queries/subscription');

describe('previewNextSundayCycle', () => {
  const settings = { lock_day: 3, lock_hour: 17 };
  const source = {
    delivery: false,
    delivery_date: '2026-11-29',
    meal_count: 15,
    plan_id: 'plan-15',
    plan_price_cents: 27000,
    special_note: 'Leave at side door',
    subscription_cycle_items: [
      { id: 1, kind: 'plan', quantity: 8, product_id: 1 },
      { id: 2, kind: 'plan', quantity: 7, product_id: 2 },
    ],
  };

  it('honors pending_plan size and does not mirror mismatched meals', () => {
    const preview = previewNextSundayCycle(
      {
        id: 'sub-1',
        plan_id: 'plan-15',
        pending_plan_id: 'plan-10',
        pending_plan: { id: 'plan-10', meal_count: 10, price_cents: 18000 },
        subscription_plans: { meal_count: 15, price_cents: 27000 },
        delivery: false,
      },
      source,
      '2026-12-06',
      settings,
    );
    assert.equal(preview.meal_count, 10);
    assert.equal(preview.plan_price_cents, 18000);
    assert.equal(preview.plan_id, 'plan-10');
    assert.equal(preview.is_preview, true);
    assert.equal(preview.subscription_cycle_items.length, 0);
  });

  it('mirrors this Sunday meals when plan size matches', () => {
    const preview = previewNextSundayCycle(
      {
        id: 'sub-1',
        plan_id: 'plan-15',
        subscription_plans: { meal_count: 15, price_cents: 27000 },
        delivery: false,
      },
      source,
      '2026-12-06',
      settings,
    );
    assert.equal(preview.meal_count, 15);
    assert.equal(preview.plan_price_cents, 27000);
    assert.equal(preview.subscription_cycle_items.length, 2);
  });
});
