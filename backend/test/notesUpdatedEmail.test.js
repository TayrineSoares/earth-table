const test = require('node:test');
const assert = require('node:assert/strict');
const { renderSubscriptionManageEmail } = require('../src/utils/emailTemplates');

test('notes_updated email includes a dedicated notes copy', () => {
  const note = 'Please use roasted vegetables with sweet potatoes instead of any rice';
  const msg = renderSubscriptionManageEmail({
    kind: 'notes_updated',
    firstName: 'Justina',
    deliveryLabel: 'Sunday, November 29',
    notes: note,
  });
  assert.match(msg.subject, /Notes saved for Sunday, November 29/);
  assert.match(msg.html, /Notes updated, Justina/);
  assert.match(msg.html, /Here's a copy/);
  assert.match(msg.html, /Notes/);
  assert.match(msg.html, new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(msg.text, new RegExp(`Notes\\n${note}`));
  // Notes live in their own block, not jammed into the intro sentence.
  assert.doesNotMatch(msg.text, new RegExp(`here's a copy[^\\n]*${note}`, 'i'));
});

test('notes_updated cleared notes shows none copy', () => {
  const msg = renderSubscriptionManageEmail({
    kind: 'notes_updated',
    firstName: 'Justina',
    deliveryLabel: 'Sunday, November 29',
    notes: '',
  });
  assert.match(msg.html, /None — notes cleared/);
  assert.match(msg.text, /None — notes cleared/);
});
