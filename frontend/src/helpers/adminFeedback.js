/** Success FeedbackDialog payload for admin create/update actions. */
export function adminSuccessDialog(label, action = 'updated') {
  const name = String(label || '').trim() || 'Item';
  const verb = action === 'added' ? 'added' : 'updated';
  return {
    icon: 'alert',
    title: action === 'added' ? 'Added' : 'Updated',
    body: `${name} was ${verb}.`,
    primaryLabel: 'Got it',
  };
}
