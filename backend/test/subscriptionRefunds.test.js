const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  withHst,
  hstDelta,
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
