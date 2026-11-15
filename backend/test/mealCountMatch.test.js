const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sumPlanMealQty,
  resolvePlanMealNeed,
  mealCountMismatch,
  canCopyOrSeedPlanMeals,
  planChangeMealsOk,
  planChangeDefersToNextWeek,
  mealMismatchAdminNote,
} = require('../src/utils/mealCountMatch');

describe('sumPlanMealQty', () => {
  it('sums plan lines and ignores add-ons', () => {
    assert.equal(
      sumPlanMealQty([
        { kind: 'plan', quantity: 4 },
        { kind: 'plan', quantity: 6 },
        { kind: 'addon', quantity: 99 },
      ]),
      10
    );
  });

  it('treats missing kind as plan', () => {
    assert.equal(sumPlanMealQty([{ quantity: 3 }, { quantity: 2 }]), 5);
  });

  it('handles empty / bad qty', () => {
    assert.equal(sumPlanMealQty([]), 0);
    assert.equal(sumPlanMealQty(null), 0);
    assert.equal(sumPlanMealQty([{ kind: 'plan', quantity: 'x' }]), 0);
  });
});

describe('resolvePlanMealNeed', () => {
  it('prefers cycle meal_count over plan', () => {
    assert.equal(resolvePlanMealNeed(15, 10), 15);
  });

  it('falls back to plan then 0', () => {
    assert.equal(resolvePlanMealNeed(null, 10), 10);
    assert.equal(resolvePlanMealNeed(undefined, undefined), 0);
  });
});

describe('mealCountMismatch', () => {
  it('returns null when exact or need unknown', () => {
    assert.equal(mealCountMismatch(10, 10), null);
    assert.equal(mealCountMismatch(0, 0), null);
    assert.equal(mealCountMismatch(5, null), null);
  });

  it('flags short boxes (upgrade / under-filled)', () => {
    const m = mealCountMismatch(10, 15);
    assert.deepEqual(m, { need: 15, got: 10, short: true, over: false, diff: 5 });
  });

  it('flags over boxes (downgrade leftover)', () => {
    const m = mealCountMismatch(15, 10);
    assert.deepEqual(m, { need: 10, got: 15, short: false, over: true, diff: 5 });
  });

  it('flags empty vs plan', () => {
    const m = mealCountMismatch(0, 15);
    assert.equal(m.short, true);
    assert.equal(m.diff, 15);
  });
});

describe('canCopyOrSeedPlanMeals', () => {
  it('allows copy when qty matches need', () => {
    assert.equal(canCopyOrSeedPlanMeals(15, 15), true);
  });

  it('blocks short/over copy onto a sized plan (Justina case)', () => {
    assert.equal(canCopyOrSeedPlanMeals(10, 15), false);
    assert.equal(canCopyOrSeedPlanMeals(15, 10), false);
  });

  it('allows copy when destination size unknown', () => {
    assert.equal(canCopyOrSeedPlanMeals(10, 0), true);
    assert.equal(canCopyOrSeedPlanMeals(10, null), true);
  });
});

describe('planChangeMealsOk', () => {
  it('requires exact count for upgrade and downgrade', () => {
    assert.equal(planChangeMealsOk(15, 15), true);
    assert.equal(planChangeMealsOk(10, 15), false);
    assert.equal(planChangeMealsOk(15, 10), false);
    assert.equal(planChangeMealsOk(0, 10), false);
  });
});

describe('planChangeDefersToNextWeek', () => {
  it('defers after Tuesday charge', () => {
    assert.equal(planChangeDefersToNextWeek({ beforeCharge: false, planPaidCents: 0 }), true);
    assert.equal(planChangeDefersToNextWeek({ beforeCharge: false, planPaidCents: 27000 }), true);
  });

  it('defers when this Sunday is already paid (first box)', () => {
    assert.equal(planChangeDefersToNextWeek({ beforeCharge: true, planPaidCents: 27000 }), true);
  });

  it('applies now only when before charge and unpaid', () => {
    assert.equal(planChangeDefersToNextWeek({ beforeCharge: true, planPaidCents: 0 }), false);
  });
});

describe('mealMismatchAdminNote', () => {
  it('is empty when matched', () => {
    assert.equal(mealMismatchAdminNote(10, 10), '');
    assert.equal(mealMismatchAdminNote(0, 0), '');
  });

  it('uses contact-customer copy for short and over', () => {
    assert.equal(
      mealMismatchAdminNote(10, 15),
      'Only 10 meals selected — please contact customer'
    );
    assert.equal(
      mealMismatchAdminNote(1, 15),
      'Only 1 meal selected — please contact customer'
    );
    assert.equal(
      mealMismatchAdminNote(15, 10),
      '15 meals selected (plan is 10) — please contact customer'
    );
  });
});
