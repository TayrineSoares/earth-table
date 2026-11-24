/**
 * Pure helpers for plan size vs selected meal qty.
 * Used by lock, copy-forward, plan-change confirm, and admin mismatch copy.
 */

function sumPlanMealQty(items) {
  return (items || []).reduce((sum, item) => {
    if (item.kind && item.kind !== 'plan') return sum;
    return sum + (Number(item.quantity) || 0);
  }, 0);
}

function resolvePlanMealNeed(cycleMealCount, planMealCount) {
  return Number(cycleMealCount) || Number(planMealCount) || 0;
}

/**
 * @returns {null | { need: number, got: number, short: boolean, over: boolean, diff: number }}
 */
function mealCountMismatch(got, need) {
  const g = Number(got) || 0;
  const n = Number(need) || 0;
  if (!n || g === n) return null;
  const diff = Math.abs(n - g);
  return {
    need: n,
    got: g,
    short: g < n,
    over: g > n,
    diff,
  };
}

/** Copy/seed next week only when qty matches the destination plan size (or size unknown). */
function canCopyOrSeedPlanMeals(srcQty, need) {
  const n = Number(need) || 0;
  if (!n) return true;
  return (Number(srcQty) || 0) === n;
}

/**
 * Shared by ensureCycle / openNextWeek / copy-forward:
 * only seed plan lines when source qty matches destination meal_count.
 */
function shouldSeedPlanMealsFromSource(sourceItems, need) {
  const meals = (sourceItems || []).filter((item) => !item.kind || item.kind === 'plan');
  const mealQty = sumPlanMealQty(meals);
  if (!meals.length) {
    return { seed: false, mealQty: 0, meals: [] };
  }
  return {
    seed: canCopyOrSeedPlanMeals(mealQty, need),
    mealQty,
    meals,
  };
}

/** Plan change confirm: selected lines must equal the new plan size. */
function planChangeMealsOk(mealQty, nextCount) {
  return (Number(mealQty) || 0) === (Number(nextCount) || 0);
}

/**
 * Defer size change to the following week only when this Sunday's box is locked
 * (or there is no open cycle). Paid+open weeks apply now with a Stripe delta
 * refund/charge — see changeSubscriptionPlan.
 */
function planChangeDefersToNextWeek({ cycleStatus } = {}) {
  if (!cycleStatus) return true;
  return cycleStatus !== 'open';
}

/** Admin / print warning — empty when no real mismatch. */
function mealMismatchAdminNote(selected, planCount) {
  const mismatch = mealCountMismatch(selected, planCount);
  if (!mismatch) return '';
  if (mismatch.short) {
    return `Only ${mismatch.got} ${mismatch.got === 1 ? 'meal' : 'meals'} selected — please contact customer`;
  }
  return `${mismatch.got} meals selected (plan is ${mismatch.need}) — please contact customer`;
}

module.exports = {
  sumPlanMealQty,
  resolvePlanMealNeed,
  mealCountMismatch,
  canCopyOrSeedPlanMeals,
  shouldSeedPlanMealsFromSource,
  planChangeMealsOk,
  planChangeDefersToNextWeek,
  mealMismatchAdminNote,
};
