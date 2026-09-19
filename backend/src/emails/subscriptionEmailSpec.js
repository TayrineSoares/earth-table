/**
 * Subscription email copy, cadence, and repeated phrases.
 * Keep in sync with frontend/src/helpers/subscriptionCadence.js
 *
 * Charge: Wednesday 9:00 AM ET (plan + delivery) — one email from that job.
 * Lock: Thursday 5:00 PM ET (add-ons + meal lock).
 * Pause / cancel / plan-change for this Sunday: before Wednesday 9:00 AM ET.
 */

const CADENCE = {
  TIMEZONE: 'America/Toronto',
  CHARGE_WEEKDAY: 3,
  CHARGE_HOUR: 9,
  CHARGE_MINUTE: 0,
  LOCK_WEEKDAY: 4,
  LOCK_HOUR: 17,
  LOCK_MINUTE: 0,
  PAUSE_NUDGE_WEEKDAY: 1,
  PAUSE_NUDGE_HOUR: 9,
  PAUSE_NUDGE_WEEKS: [1, 4],
  UPDATE_DEBOUNCE_MS: 60 * 60 * 1000,
  // Monday 9:00 AM ET with the pause reminder. Email once per card in this window.
  CARD_EXPIRY_DAYS: 30,
};

const PAUSE_CANCEL_BY = 'Wednesday at 9:00 AM ET';
const MEAL_LOCK_BY = 'Thursday at 5:00 PM ET';
const PICKUP_ADDRESS = '77 Woodstream Blvd, Vaughan, ON L4L 7Y7';
const DELIVERY_WINDOW = '11:00 AM – 6:00 PM';

const CTA = {
  manage: 'Manage my subscription',
  changeMeals: 'Change my meals',
  addExtras: 'Add extras',
  resume: 'Resume my plan',
  chooseMeals: 'Choose my meals',
  browseMenu: 'Browse the menu',
  viewSubscription: 'View subscription',
  openPrep: 'Open prep sheet',
  viewCustomer: 'View customer',
};

const HELLO = 'hello@earthtableco.ca';

function fill(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (
    vars[key] == null ? '' : String(vars[key])
  ));
}

const COPY = {
  welcome: {
    subject: 'Welcome to weekly plans — your first box is {fulfillmentDate}',
    preview: 'Your {mealCount}-meal plan is active. Change your meals any time before {cutoffDateTime}.',
    heading: 'Welcome to weekly plans, {firstName}',
    intro: "Thank you for subscribing — we're so glad you're here. Your first box is **{fulfillmentDate}**.",
    body: 'Your {mealCount} meals are picked and paid for, so there\'s nothing you need to do. Until **{cutoffDateTime}** you can swap meals or add extras — smoothies, sides, snacks, anything on the menu.',
    afterCutoff: 'After the cutoff we cook fresh, and your box is ready {weekday}. Your plan continues each week — if you don\'t update your meals by the cutoff, we\'ll send the same selection as last week.',
    signoff: 'Thank you for trusting us with your meals. — Selena & the Earth Table team',
  },
  wednesday: {
    subject: 'Pick your meals for Sunday — cutoff is tomorrow at 5 PM',
    preview: 'Swap meals or add extras before {cutoffDateTime}.',
    heading: 'Your box for {fulfillmentDate}',
    intro: "You've got until **tomorrow, {cutoffDateTime}** to change anything. Here's what you're set for:",
    swap: "If you'd like something different this week, there's still time to swap.",
    extras: "**Room for a little extra?** Add a smoothie, a side, a soup, or dessert to this week's box — they're charged at the {cutoffDateTime} lock.",
  },
  thursday: {
    subject: "Sunday's box is set",
    preview: "Here's what's coming, and when to pick it up.",
    heading: "{weekday}'s box is set",
    intro: "We're cooking these for you:",
  },
  updated: {
    subject: 'Your Sunday box has been updated',
    preview: "Here's your new selection for {fulfillmentDate}.",
    heading: "You've updated {weekday}'s box",
    intro: "Here's what's in it now:",
    until: 'You can still modify until **{cutoffDateTime}**.',
  },
  pauseNow: {
    subject: 'Your weekly plan is paused',
    preview: "No boxes and no charges until you're ready.",
    heading: 'Your plan is paused',
    intro: 'No boxes and no charges until you turn it back on. Your plan and meal preferences are saved exactly as they were.',
    after: 'Come back any time — if you resume by {chargeLabel}, you\'ll get that Sunday\'s box.',
  },
  pauseNext: {
    subject: 'Your weekly plan is paused',
    preview: "No boxes and no charges until you're ready.",
    heading: 'Your plan is paused',
    intro: 'This Sunday still goes out. After that, no boxes and no charges until you turn it back on. Your plan and meal preferences are saved exactly as they were.',
    after: 'Come back any time — if you resume by {chargeLabel}, you\'ll get that Sunday\'s box.',
  },
  pauseNudge: {
    subject: 'Want a box this Sunday?',
    preview: "Resume by {chargeLabel} and we'll have it ready.",
    heading: 'Your plan is still paused',
    intro: "If you'd like meals this Sunday, resume by **{cutoffDateTime}** and we'll have your box ready.",
    after: "Not yet? No problem — nothing happens until you say so.",
  },
  resume: {
    subject: "You're back — first box {fulfillmentDate}",
    preview: 'Your weekly plan is active again.',
    heading: 'Welcome back, {firstName}',
    intro: 'Your weekly plan is active again. Your next box is **{fulfillmentDate}**.',
    after: "Pick your meals before **{cutoffDateTime}** — or we'll send your usual selection.",
  },
  cancel: {
    subject: 'Your weekly plan is cancelled',
    preview: 'No further boxes or charges. You can still order à la carte.',
    heading: 'Your plan is cancelled',
    intro: 'No further boxes, no further charges.',
    lastBox: "Your last box is {fulfillmentDate} — that one's already paid for and we'll have it ready.",
    after: "You can still order à la carte any time, and you're welcome back on a plan whenever it suits you.",
    reply: "If something went wrong or the timing just wasn't right, we'd genuinely like to know — just reply to this email and it comes straight to us.",
    signoff: 'Thank you for eating with us. — Selena & the Earth Table team',
  },
  paymentFailed: {
    subject: "We couldn't process your payment for Sunday's box",
    preview: 'Your plan is paused until you add a new card.',
    heading: "We couldn't charge your card",
    intro: "Your {planPrice} payment for **{fulfillmentDate}** didn't go through — the card on file is {cardBrand} •••• {last4}.",
    after: 'Your plan is paused until you add a new card in My Subscriptions. Once a working card is on file, weekly boxes start again.',
    note: "This Sunday's box will not go out.",
  },
  planUp: {
    subject: 'Your plan is now {newMealCount} meals a week',
    preview: 'Takes effect with your box on {effectiveDate}.',
    heading: 'Your plan has changed',
    intro: "You're now on **{newMealCount} meals a week at {newPrice}** — up from {oldMealCount} meals at {oldPrice}.",
    effect: 'This takes effect with your box on **{effectiveDate}**, and {newPrice} will be charged on {nextChargeDate}.',
    fill: "You've got {difference} more meals to fill. Pick them before **{cutoffDateTime}**.",
  },
  planDown: {
    subject: 'Your plan is now {newMealCount} meals a week',
    preview: 'Takes effect with your box on {effectiveDate}.',
    heading: 'Your plan has changed',
    intro: "You're now on **{newMealCount} meals a week at {newPrice}** — down from {oldMealCount} at {oldPrice}.",
    effect: 'This takes effect with your box on **{effectiveDate}**, and {newPrice} will be charged on {nextChargeDate}. Your selections have been trimmed to your first {newMealCount} meals; change them any time before **{cutoffDateTime}**.',
  },
  fulfillmentDelivery: {
    subject: "You're switched to delivery",
    preview: 'Starting with {fulfillmentDate}.',
    heading: "You've switched to delivery",
    intro: 'Starting with **{fulfillmentDate}**, your box comes to you:',
    after: 'Switch back to pickup any time before {cutoffDateTime}.',
  },
  fulfillmentPickup: {
    subject: "You're switched to pickup",
    preview: 'Starting with {fulfillmentDate}.',
    heading: "You've switched to pickup",
    intro: 'Starting with **{fulfillmentDate}**, your box will be labeled and waiting at:',
    after: 'Switch back to delivery any time before {cutoffDateTime}.',
  },
  cardExpiry: {
    subject: 'This card expires {expMonth}/{expYear}',
    preview: 'Update it before then and nothing on your plan changes.',
    heading: 'Your card is expiring',
    intro: 'This card expires {expMonth}/{expYear}. Update it before then and nothing on your plan changes.',
  },
  holiday: {
    subject: 'No box this Sunday — next delivery is {nextSunday}',
    preview: '{skippedSunday} is a holiday, so there is no box and no charge.',
    heading: 'No box this Sunday, {firstName}',
    intro: 'Sunday {skippedSunday} is a holiday, so there is no box and no charge. Your next delivery is **{nextSunday}**. Weekly billing stays on the usual {chargeLabel} schedule.',
  },
  ownerWelcome: {
    subject: 'New subscription — {customerName}, {mealCount} meals/week ({price})',
    heading: 'New subscription',
  },
  ownerThursday: {
    subject: "This Sunday's subscriptions — {fulfillmentDate} ({planCount} plans)",
    heading: "This Sunday's subscriptions — {fulfillmentDate}",
  },
  ownerPaused: {
    subject: 'Plan paused — {customerName} ({mealCount} meals)',
    heading: 'Plan paused',
  },
  ownerResumed: {
    subject: 'Plan resumed — {customerName} ({mealCount} meals)',
    heading: 'Plan resumed',
  },
  ownerCancelled: {
    subject: 'Plan cancelled — {customerName} ({mealCount} meals, −{price}/wk)',
    heading: 'Plan cancelled',
  },
  ownerPlan: {
    subject: 'Plan changed — {customerName}, {oldMealCount} → {newMealCount} meals ({signedDiff}/wk)',
    heading: 'Plan changed',
  },
  ownerFulfillment: {
    subject: 'Switched to {method} — {customerName}, {fulfillmentDate}',
    heading: 'Fulfillment changed',
  },
  ownerPaymentFailed: {
    subject: 'Payment failed — {customerName}, {amount}',
    heading: 'Payment failed',
  },
  ownerHoliday: {
    subject: 'Holiday skip — no boxes {skippedSunday}',
    heading: 'Holiday skip',
    intro: 'Sunday {skippedSunday} is a holiday. No weekly boxes go out and no one is charged. Next Sunday that runs is {nextSunday}.',
  },
};

module.exports = {
  CADENCE,
  PAUSE_CANCEL_BY,
  MEAL_LOCK_BY,
  PICKUP_ADDRESS,
  DELIVERY_WINDOW,
  CTA,
  HELLO,
  COPY,
  fill,
};
