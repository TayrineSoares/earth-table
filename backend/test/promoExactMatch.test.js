const { test } = require('node:test');
const assert = require('node:assert/strict');
const { escapeIlikeExact, normalize } = require('../src/queries/promo_code');

test('escapeIlikeExact neutralizes wildcard characters', () => {
  assert.equal(escapeIlikeExact('%'), '\\%');
  assert.equal(escapeIlikeExact('_'), '\\_');
  assert.equal(escapeIlikeExact('A%B_C'), 'A\\%B\\_C');
  assert.equal(escapeIlikeExact('SUMMER20'), 'SUMMER20');
});

test('normalize trims promo input', () => {
  assert.equal(normalize('  summer  '), 'summer');
  assert.equal(normalize(''), '');
});
