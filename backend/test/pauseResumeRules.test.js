const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  cycleIsCommitted,
  resumeShouldChargeNow,
  pauseKeepsThisSunday,
} = require('../src/queries/subscriptionPauseResumeRules');

describe('pause / resume decision rules', () => {
  it('cycleIsCommitted is true for paid or locked weeks', () => {
    assert.equal(cycleIsCommitted({ status: 'open', plan_paid_cents: 27000 }), true);
    assert.equal(cycleIsCommitted({ status: 'locked', plan_paid_cents: 0 }), true);
    assert.equal(cycleIsCommitted({ status: 'open', plan_paid_cents: 0 }), false);
    assert.equal(cycleIsCommitted(null), false);
  });

  it('pauseKeepsThisSunday is locked-only (paid+open refunds and skips)', () => {
    assert.equal(pauseKeepsThisSunday({ status: 'locked', plan_paid_cents: 0 }), true);
    assert.equal(pauseKeepsThisSunday({ status: 'locked', plan_paid_cents: 100 }), true);
    assert.equal(pauseKeepsThisSunday({ status: 'open', plan_paid_cents: 100 }), false);
    assert.equal(pauseKeepsThisSunday({ status: 'open', plan_paid_cents: 0 }), false);
  });

  it('manual resume before Tuesday does not charge', () => {
    assert.equal(resumeShouldChargeNow({
      pauseReason: 'manual',
      beforeTuesdayCharge: true,
      cookWeekCommitted: false,
    }), false);
  });

  it('manual resume after Tuesday charges unpaid weeks only', () => {
    assert.equal(resumeShouldChargeNow({
      pauseReason: 'manual',
      beforeTuesdayCharge: false,
      cookWeekCommitted: false,
    }), true);
    assert.equal(resumeShouldChargeNow({
      pauseReason: 'manual',
      beforeTuesdayCharge: false,
      cookWeekCommitted: true,
    }), false);
  });

  it('payment_failed resume charges unless the week is already paid', () => {
    assert.equal(resumeShouldChargeNow({
      pauseReason: 'payment_failed',
      beforeTuesdayCharge: true,
      cookWeekCommitted: false,
    }), true);
    assert.equal(resumeShouldChargeNow({
      pauseReason: 'payment_failed',
      beforeTuesdayCharge: false,
      cookWeekCommitted: true,
    }), false);
  });
});
