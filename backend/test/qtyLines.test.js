const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { qtyLines } = require('../src/queries/subscriptionCheckout');
const { planChangeMealsOk, sumPlanMealQty } = require('../src/utils/mealCountMatch');

describe('qtyLines + plan change confirm', () => {
  it('merges duplicate product ids', () => {
    const lines = qtyLines([
      { id: 1, quantity: 2 },
      { product_id: 1, quantity: 3 },
      { id: 2, quantity: 5 },
    ]);
    assert.deepEqual(lines.sort((a, b) => a.id - b.id), [
      { id: 1, quantity: 5 },
      { id: 2, quantity: 5 },
    ]);
  });

  it('drops invalid rows', () => {
    assert.deepEqual(qtyLines([{ id: 1, quantity: 0 }, { id: 'x', quantity: 2 }]), []);
  });

  it('accepts exact plan size after qtyLines (upgrade 10→15)', () => {
    const lines = qtyLines([
      { id: 10, quantity: 5 },
      { id: 11, quantity: 5 },
      { id: 12, quantity: 5 },
    ]);
    const mealQty = lines.reduce((sum, line) => sum + line.quantity, 0);
    assert.equal(mealQty, 15);
    assert.equal(planChangeMealsOk(mealQty, 15), true);
    assert.equal(planChangeMealsOk(mealQty, 10), false);
  });

  it('rejects leftover over-count on downgrade confirm', () => {
    const lines = qtyLines([
      { id: 1, quantity: 8 },
      { id: 2, quantity: 7 },
    ]);
    const mealQty = lines.reduce((sum, line) => sum + line.quantity, 0);
    assert.equal(planChangeMealsOk(mealQty, 10), false);
    assert.equal(sumPlanMealQty(lines.map((l) => ({ ...l, kind: 'plan' }))), 15);
  });
});
