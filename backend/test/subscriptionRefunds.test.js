const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  withHst,
  hstDelta,
  listPlanDeltaPaymentIntentIds,
  latestPlanDeltaPaymentIntentId,
  planDeltaPiWriteFields,
  clearPlanDeltaPiFields,
} = require('../src/queries/subscriptionRefunds');

describe('subscriptionRefunds math', () => {
  it('withHst rounds like charge jobs', () => {
    assert.equal(withHst(27000), 30510);
    assert.equal(withHst(1500), 1695);
    assert.equal(withHst(0), 0);
  });

  it('hstDelta matches separate rounded legs', () => {
    // Downgrade 15→10 meal style: refund difference of taxed amounts
    assert.equal(hstDelta(27000, 18000), withHst(27000) - withHst(18000));
    assert.equal(hstDelta(18000, 27000), withHst(18000) - withHst(27000));
  });
});

describe('plan delta PI id list', () => {
  it('reads jsonb array and falls back to singular', () => {
    assert.deepEqual(
      listPlanDeltaPaymentIntentIds({
        stripe_plan_delta_payment_intent_ids: ['pi_a', 'pi_b'],
        stripe_plan_delta_payment_intent_id: 'pi_b',
      }),
      ['pi_a', 'pi_b']
    );
    assert.deepEqual(
      listPlanDeltaPaymentIntentIds({
        stripe_plan_delta_payment_intent_id: 'pi_only',
      }),
      ['pi_only']
    );
    assert.equal(latestPlanDeltaPaymentIntentId({
      stripe_plan_delta_payment_intent_ids: ['pi_a', 'pi_b'],
    }), 'pi_b');
  });

  it('appends without duplicating and clears both fields', () => {
    const once = planDeltaPiWriteFields({
      stripe_plan_delta_payment_intent_ids: ['pi_a'],
      stripe_plan_delta_payment_intent_id: 'pi_a',
    }, 'pi_b');
    assert.deepEqual(once.stripe_plan_delta_payment_intent_ids, ['pi_a', 'pi_b']);
    assert.equal(once.stripe_plan_delta_payment_intent_id, 'pi_b');
    const again = planDeltaPiWriteFields(once, 'pi_b');
    assert.deepEqual(again.stripe_plan_delta_payment_intent_ids, ['pi_a', 'pi_b']);
    assert.deepEqual(clearPlanDeltaPiFields(), {
      stripe_plan_delta_payment_intent_ids: [],
      stripe_plan_delta_payment_intent_id: null,
    });
  });
});
