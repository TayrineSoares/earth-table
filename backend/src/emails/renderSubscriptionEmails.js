/**
 * Subscription transactional emails. Copy lives in subscriptionEmailSpec.js.
 */

const {
  wrapEmail,
  eyebrow,
  h1,
  h2,
  intro,
  card,
  kvTable,
  kvRow,
  ctaLink,
  ctaPair,
  bodyP,
  signoffP,
  itemListHtml,
  itemLinesHtml,
  itemLinesText,
  appUrl,
  formatDollars,
  formatPhone,
  mdText,
  weekdayFromLabel,
  windowFor,
  formatCardBrand,
  adminHref,
  C_INK,
  C_MUTED,
  C_AMBER,
  C_CREAM,
  C_LINE,
  FONT,
} = require('../utils/emailTemplates');
const { mealsAWeek } = require('../queries/subscriptionWeek');
const {
  COPY,
  CTA,
  fill,
  PICKUP_ADDRESS,
  PAUSE_CANCEL_BY,
  MEAL_LOCK_BY,
} = require('./subscriptionEmailSpec');

function customerWrap(inner, { subject, preview, replyOk = false }) {
  return wrapEmail(inner, {
    preheader: preview,
    replyOk,
    footer: replyOk ? 'reply' : 'noreply',
    title: subject,
  });
}

function ownerWrap(inner, { subject, preview, extraCss }) {
  return wrapEmail(inner, {
    preheader: preview || subject,
    footer: 'owner',
    title: subject,
    extraCss,
  });
}

function nextBoxValue({ delivery, pickupSlot, fulfillmentDate }) {
  const win = windowFor(delivery, pickupSlot);
  const windowLabel = win.end ? `${win.start} – ${win.end}` : win.start;
  const method = delivery ? 'Delivery' : 'Pickup';
  return `${method} ${fulfillmentDate || 'Sunday'}, ${windowLabel}`;
}

function planSummaryCard({
  mealCount,
  planPriceCents,
  fulfillmentDate,
  delivery,
  pickupSlot,
  address,
  notes,
  cutoffDateTime,
}) {
  const note = String(notes || '').trim();
  const loc = String(address || '').trim();
  const deliveryLoc = loc || note || '—';
  return card(kvTable(`
    ${kvRow('Plan', mealsAWeek(mealCount))}
    ${kvRow('Price', `${formatDollars(planPriceCents)}/week + HST`)}
    ${kvRow('Next box', nextBoxValue({ delivery, pickupSlot, fulfillmentDate }))}
    ${delivery
      ? `${kvRow('Delivery Address', deliveryLoc)}${kvRow('Notes', note || '—')}`
      : `${kvRow('Address', loc || PICKUP_ADDRESS)}${kvRow('Notes', note || '—')}`}
    ${kvRow('Change meals by', cutoffDateTime, { last: true })}
  `));
}

function planSummaryText(opts) {
  const note = String(opts.notes || '').trim();
  const loc = String(opts.address || '').trim();
  const deliveryLoc = loc || note || '—';
  const lines = [
    `Plan: ${mealsAWeek(opts.mealCount)}`,
    `Price: ${formatDollars(opts.planPriceCents)}/week + HST`,
    `Next box: ${nextBoxValue(opts)}`,
  ];
  if (opts.delivery) {
    lines.push(`Delivery Address: ${deliveryLoc}`, `Notes: ${note || '—'}`);
  } else {
    lines.push(`Address: ${loc || PICKUP_ADDRESS}`, `Notes: ${note || '—'}`);
  }
  lines.push(`Change meals by: ${opts.cutoffDateTime}`);
  return lines.join('\n');
}

function chargedPlanLine({ planCents, deliveryCents, chargedCents, cardBrand, last4 }) {
  const deliv = Number(deliveryCents) > 0 ? ` + ${formatDollars(deliveryCents)} delivery` : '';
  return `Charged today — ${formatDollars(planCents)} plan${deliv} = **${formatDollars(chargedCents)}** to ${formatCardBrand(cardBrand)} •••• ${last4}`;
}

function chargedExtrasLine({ extrasTotal, cardBrand, last4 }) {
  return `Add-ons charged today — ${extrasTotal} extras to ${formatCardBrand(cardBrand)} •••• ${last4}`;
}

function renderSubscriptionWelcomeEmail({
  firstName,
  mealCount,
  planPriceCents,
  delivery,
  deliveryLabel,
  pickupSlot,
  cutoffLabel,
  subscriptionId,
  address,
  notes,
  meals,
} = {}) {
  const vars = {
    firstName: firstName || 'there',
    mealCount,
    fulfillmentDate: deliveryLabel || 'Sunday',
    cutoffDateTime: cutoffLabel,
    weekday: weekdayFromLabel(deliveryLabel),
  };
  const c = COPY.welcome;
  const subject = fill(c.subject, vars);
  const preview = fill(c.preview, vars);
  const manageHref = appUrl(`/my-subscriptions/${subscriptionId || ''}`);
  const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(fill(c.heading, vars))}
      ${intro(fill(c.intro, vars).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}
      ${bodyP(fill(c.body, vars))}
      ${planSummaryCard({
        mealCount,
        planPriceCents: planPriceCents || 0,
        fulfillmentDate: vars.fulfillmentDate,
        delivery,
        pickupSlot,
        address: address || (delivery ? address : PICKUP_ADDRESS),
        notes,
        cutoffDateTime: cutoffLabel,
      })}
      ${h2('This week\'s meals')}
      ${itemListHtml(meals, '—')}
      ${ctaLink(manageHref, CTA.manage)}
      ${bodyP(fill(c.afterCutoff, vars))}
      ${signoffP(c.signoff)}
  `, { subject, preview });
  const text = [
    mdText(fill(c.heading, vars)),
    '',
    mdText(fill(c.intro, vars)),
    '',
    mdText(fill(c.body, vars)),
    '',
    planSummaryText({
      mealCount,
      planPriceCents: planPriceCents || 0,
      fulfillmentDate: vars.fulfillmentDate,
      delivery,
      pickupSlot,
      address: address || (delivery ? address : PICKUP_ADDRESS),
      notes,
      cutoffDateTime: cutoffLabel,
    }),
    '',
    'This week\'s meals',
    itemLinesText(meals) || '—',
    '',
    `${CTA.manage}: ${manageHref}`,
    '',
    mdText(fill(c.afterCutoff, vars)),
    '',
    c.signoff,
  ].join('\n');
  return { subject, html, text };
}

function renderOwnerSubscriptionEmail({
  firstName,
  lastName,
  mealCount,
  planPriceCents,
  delivery,
  deliveryLabel,
  pickupSlot,
  subscribedAtLabel,
  paidCents,
  meals,
  addons,
  email,
  phone,
  notes,
  address,
  chargeLabel,
  discountCode,
  discountKind,
  discountLabel,
  planSavedCents,
  addonSavedCents,
  addonRegularCents,
} = {}) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Customer';
  const vars = {
    customerName: fullName,
    mealCount,
    price: formatDollars(planPriceCents),
    fulfillmentDate: deliveryLabel || 'Sunday',
  };
  const c = COPY.ownerWelcome;
  const subject = fill(c.subject, vars);
  const note = String(notes || '').trim();
  const loc = String(address || '').trim();
  const deliveryLoc = loc || note || '—';
  const paidLabel = `${formatDollars(paidCents)} including HST`;
  const addonHtml = itemLinesHtml(addons);
  const renews = chargeLabel || PAUSE_CANCEL_BY;
  const planOff = Math.max(0, Number(planSavedCents) || 0);
  const addonOff = Math.max(0, Number(addonSavedCents) || 0);
  const addonRegular = Math.max(0, Number(addonRegularCents) || 0);
  const code = String(discountCode || '').toUpperCase();
  const codeLabel = discountLabel
    || (code
      ? `${discountKind === 'promo' ? 'Promo' : discountKind === 'referral' ? 'Referral' : 'Code'} (${code})`
      : 'First-week discount');
  const html = ownerWrap(`
      ${eyebrow('New subscription')}
      ${h1(c.heading)}
      ${h2(`${fullName} — ${mealCount} meals a week`)}
      ${intro(`Subscribed ${subscribedAtLabel || 'just now'}. First box: <strong>${vars.fulfillmentDate}.</strong>`)}
      ${card(kvTable(`
        ${kvRow('Regular price', `${mealCount} meals a week, ${formatDollars(planPriceCents)}/week + HST`)}
        ${planOff > 0 ? kvRow(`${codeLabel} · first week only`, `−${formatDollars(planOff)}`) : ''}
        ${addonRegular > 0
          ? kvRow(
            'Add-ons (cutoff)',
            addonOff > 0
              ? `${formatDollars(addonRegular)} regular · ${codeLabel} −${formatDollars(addonOff)}`
              : formatDollars(addonRegular)
          )
          : ''}
        ${kvRow('Next box', nextBoxValue({ delivery, pickupSlot, fulfillmentDate: vars.fulfillmentDate }))}
        ${kvRow('Paid today', paidLabel, { highlight: planOff > 0 || addonOff > 0 })}
        ${kvRow('Renews', renews)}
        ${kvRow('Customer', `${email || '—'} · ${formatPhone(phone)}`)}
        ${delivery
          ? `${kvRow('Delivery Address', deliveryLoc)}${kvRow('Notes', note || deliveryLoc, { last: true })}`
          : `${kvRow('Address', loc || PICKUP_ADDRESS, { last: !note })}${note ? kvRow('Notes', note, { last: true }) : ''}`}
      `))}
      ${h2('Meals selected')}
      ${itemListHtml(meals, '—')}
      ${addonHtml ? `${h2('Extras')}${itemListHtml(addons, '')}` : ''}
      ${ctaLink(adminHref(), CTA.viewSubscription)}
  `, { subject });
  const text = [
    subject,
    `Subscribed ${subscribedAtLabel || 'just now'}. First box: ${vars.fulfillmentDate}.`,
    `Regular price — ${mealCount} meals a week, ${formatDollars(planPriceCents)}/week + HST`,
    planOff > 0 ? `Discount — ${codeLabel} · first week only −${formatDollars(planOff)}` : null,
    addonRegular > 0
      ? (addonOff > 0
        ? `Add-ons (cutoff) — ${formatDollars(addonRegular)} regular · ${codeLabel} −${formatDollars(addonOff)}`
        : `Add-ons (cutoff) — ${formatDollars(addonRegular)}`)
      : null,
    `Next box — ${nextBoxValue({ delivery, pickupSlot, fulfillmentDate: vars.fulfillmentDate })}`,
    `Paid today — ${paidLabel}`,
    `Renews — ${renews}`,
    `Customer — ${email || '—'} · ${formatPhone(phone)}`,
    delivery
      ? `Delivery Address — ${deliveryLoc}\nNotes — ${note || deliveryLoc}`
      : `Address — ${loc || PICKUP_ADDRESS}${note ? `\nNotes — ${note}` : ''}`,
    '',
    'Meals selected',
    itemLinesText(meals) || '—',
    addonHtml ? `\nExtras\n${itemLinesText(addons)}` : '',
    `\n${CTA.viewSubscription}: ${adminHref()}`,
  ].filter((line) => line != null).join('\n');
  return { subject, html, text };
}

function renderSubscriptionUpdatedEmail({
  firstName,
  deliveryLabel,
  cutoffLabel,
  meals,
  addons,
  subscriptionId,
  notes,
} = {}) {
  const vars = {
    firstName: firstName || 'there',
    fulfillmentDate: deliveryLabel || 'Sunday',
    weekday: weekdayFromLabel(deliveryLabel),
    cutoffDateTime: cutoffLabel,
  };
  const c = COPY.updated;
  const subject = fill(c.subject, vars);
  const preview = fill(c.preview, vars);
  const manageHref = appUrl(`/my-subscriptions/${subscriptionId || ''}`);
  const note = String(notes || '').trim() || '—';
  const list = [
    itemLinesHtml(meals) || '—',
    itemLinesHtml(addons) ? `<br/>${itemLinesHtml(addons)}` : '',
  ].join('');
  const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(fill(c.heading, vars))}
      ${intro(c.intro)}
      ${card(kvTable(`
        ${kvRow('Notes', note, { last: true })}
      `))}
      <p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};">${list}</p>
      ${bodyP(fill(c.until, vars))}
      ${ctaLink(manageHref, CTA.manage)}
  `, { subject, preview });
  const text = [
    mdText(fill(c.heading, vars)),
    '',
    c.intro,
    `Notes: ${note}`,
    itemLinesText(meals) || '—',
    itemLinesText(addons) || '',
    '',
    mdText(fill(c.until, vars)),
    `${CTA.manage}: ${manageHref}`,
  ].join('\n');
  return { subject, html, text };
}

function renderSubscriptionManageEmail({
  kind,
  firstName,
  mealCount,
  nextMealCount,
  deliveryLabel,
  cutoffLabel,
  chargeLabel,
  fulfillmentDate,
  lastBox,
  planPrice,
  cardBrand,
  last4,
  oldMealCount,
  oldPrice,
  newPrice,
  difference,
  nextChargeDate,
  effectiveDate,
  address,
  notes,
  delivery,
  pickupSlot,
  expMonth,
  expYear,
  planPriceCents,
} = {}) {
  const name = firstName || 'there';
  const sunday = fulfillmentDate || deliveryLabel || 'Sunday';
  const cutoff = cutoffLabel || MEAL_LOCK_BY;
  const manageHref = appUrl('/my-subscriptions');
  const mealsHref = appUrl('/my-subscriptions');
  const menuHref = appUrl('/products/category');
  const weekday = weekdayFromLabel(sunday);
  const vars = {
    firstName: name,
    fulfillmentDate: sunday,
    cutoffDateTime: kind === 'pause_nudge'
      ? (chargeLabel || PAUSE_CANCEL_BY)
      : cutoff,
    weekday,
    planPrice: planPrice || formatDollars(planPriceCents),
    cardBrand: formatCardBrand(cardBrand),
    last4: last4 || '••••',
    newMealCount: nextMealCount,
    oldMealCount: oldMealCount || mealCount,
    newPrice,
    oldPrice,
    difference,
    nextChargeDate: nextChargeDate || chargeLabel,
    chargeLabel: chargeLabel || PAUSE_CANCEL_BY,
    effectiveDate: effectiveDate || sunday,
    expMonth: expMonth != null && expMonth !== ''
      ? String(expMonth).padStart(2, '0')
      : '',
    expYear,
  };

  if (kind === 'pause_now' || kind === 'pause_next') {
    const c = kind === 'pause_next' ? COPY.pauseNext : COPY.pauseNow;
    const subject = c.subject;
    const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${intro(c.intro)}
      ${ctaLink(manageHref, CTA.resume)}
      ${bodyP(fill(c.after, vars))}
    `, { subject, preview: c.preview });
    const text = `${c.heading}\n\n${c.intro}\n\n${CTA.resume}: ${manageHref}\n\n${fill(c.after, vars)}`;
    return { subject, html, text };
  }

  if (kind === 'pause_nudge') {
    const c = COPY.pauseNudge;
    const subject = c.subject;
    const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${intro(fill(c.intro, vars).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}
      ${ctaLink(manageHref, CTA.resume)}
      ${bodyP(c.after)}
    `, { subject, preview: fill(c.preview, vars) });
    const text = `${c.heading}\n\n${mdText(fill(c.intro, vars))}\n\n${CTA.resume}: ${manageHref}\n\n${c.after}`;
    return { subject, html, text };
  }

  if (kind === 'resume') {
    const c = COPY.resume;
    const subject = fill(c.subject, vars);
    const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(fill(c.heading, vars))}
      ${intro(fill(c.intro, vars).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}
      ${planSummaryCard({
        mealCount,
        planPriceCents: planPriceCents || 0,
        fulfillmentDate: sunday,
        delivery,
        pickupSlot,
        address,
        notes,
        cutoffDateTime: cutoff,
      })}
      ${bodyP(fill(c.after, vars))}
      ${ctaLink(mealsHref, CTA.chooseMeals)}
    `, { subject, preview: c.preview });
    const text = `${mdText(fill(c.heading, vars))}\n\n${mdText(fill(c.intro, vars))}\n\n${planSummaryText({
      mealCount,
      planPriceCents: planPriceCents || 0,
      fulfillmentDate: sunday,
      delivery,
      pickupSlot,
      address,
      notes,
      cutoffDateTime: cutoff,
    })}\n\n${mdText(fill(c.after, vars))}\n\n${CTA.chooseMeals}: ${mealsHref}`;
    return { subject, html, text };
  }

  if (kind === 'cancel_now' || kind === 'cancel_next') {
    const c = COPY.cancel;
    const last = (kind === 'cancel_next' || lastBox)
      ? ` ${fill(c.lastBox, vars)}`
      : '';
    const introText = `${c.intro}${last}`;
    const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${intro(introText)}
      ${bodyP(c.after)}
      ${ctaLink(menuHref, CTA.browseMenu)}
      ${bodyP(c.reply)}
      ${signoffP(c.signoff)}
    `, { subject: c.subject, preview: c.preview, replyOk: true });
    const text = `${c.heading}\n\n${introText}\n\n${c.after}\n\n${CTA.browseMenu}: ${menuHref}\n\n${c.reply}\n\n${c.signoff}`;
    return { subject: c.subject, html, text };
  }

  if (kind === 'payment_failed') {
    const c = COPY.paymentFailed;
    const subject = c.subject;
    const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${intro(fill(c.intro, vars).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}
      ${bodyP(fill(c.after, vars))}
      ${ctaLink(manageHref, CTA.manage)}
      ${bodyP(c.note)}
    `, { subject, preview: c.preview });
    const text = `${c.heading}\n\n${mdText(fill(c.intro, vars))}\n\n${mdText(fill(c.after, vars))}\n\n${CTA.manage}: ${manageHref}\n\n${c.note}`;
    return { subject, html, text };
  }

  if (kind === 'plan_now' || kind === 'plan_next') {
    const upgrade = Number(nextMealCount) > Number(oldMealCount || mealCount);
    const c = upgrade ? COPY.planUp : COPY.planDown;
    const subject = fill(c.subject, vars);
    const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${intro(fill(c.intro, vars).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}
      ${bodyP(fill(c.effect, vars))}
      ${c.fill ? bodyP(fill(c.fill, vars)) : ''}
      ${ctaLink(upgrade ? mealsHref : manageHref, upgrade ? CTA.chooseMeals : CTA.manage)}
    `, { subject, preview: fill(c.preview, vars) });
    const text = `${c.heading}\n\n${mdText(fill(c.intro, vars))}\n\n${mdText(fill(c.effect, vars))}\n${c.fill ? `\n${mdText(fill(c.fill, vars))}\n` : ''}\n${upgrade ? CTA.chooseMeals : CTA.manage}: ${upgrade ? mealsHref : manageHref}`;
    return { subject, html, text };
  }

  if (kind === 'fulfillment_delivery' || kind === 'fulfillment_pickup') {
    const toDelivery = kind === 'fulfillment_delivery';
    const c = toDelivery ? COPY.fulfillmentDelivery : COPY.fulfillmentPickup;
    const subject = fill(c.subject, vars);
    const boxLine = nextBoxValue({
      delivery: toDelivery,
      pickupSlot,
      fulfillmentDate: sunday,
    });
    const note = String(address || '').trim();
    const loc = toDelivery ? (note || '—') : PICKUP_ADDRESS;
    const detail = toDelivery
      ? `${kvRow('Next box', boxLine)}${kvRow('Delivery Address', loc)}${kvRow('Notes', note || loc, { last: true })}`
      : `${kvRow('Next box', boxLine)}${kvRow('Address', PICKUP_ADDRESS, { last: true })}`;
    const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${intro(fill(c.intro, vars).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}
      ${card(kvTable(detail))}
      ${bodyP(fill(c.after, vars))}
      ${ctaLink(manageHref, CTA.manage)}
    `, { subject, preview: fill(c.preview, vars) });
    const text = toDelivery
      ? `${c.heading}\n\n${mdText(fill(c.intro, vars))}\n\nNext box: ${boxLine}\nDelivery Address: ${loc}\nNotes: ${note || loc}\n\n${fill(c.after, vars)}\n\n${CTA.manage}: ${manageHref}`
      : `${c.heading}\n\n${mdText(fill(c.intro, vars))}\n\nNext box: ${boxLine}\nAddress: ${PICKUP_ADDRESS}\n\n${fill(c.after, vars)}\n\n${CTA.manage}: ${manageHref}`;
    return { subject, html, text };
  }

  if (kind === 'card_expiry') {
    const c = COPY.cardExpiry;
    const subject = fill(c.subject, vars);
    const preview = fill(c.preview, vars);
    const note = fill(c.intro, vars);
    const cardOnFile = `${vars.cardBrand} •••• ${vars.last4}`;
    const expires = vars.expYear ? `${vars.expMonth}/${vars.expYear}` : '';
    const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${card(kvTable(`
        ${kvRow('Card on file', cardOnFile)}
        ${kvRow('Expires', expires || '—', { last: true })}
      `))}
      ${intro(note)}
      ${ctaLink(manageHref, CTA.manage)}
    `, { subject, preview });
    const text = `${c.heading}\n\nCard on file: ${cardOnFile}\nExpires: ${expires}\n\n${mdText(note)}\n\n${CTA.manage}: ${manageHref}`;
    return { subject, html, text };
  }

  return {
    subject: 'Your weekly plan',
    html: customerWrap(`${h1(`Update, ${name}`)}${intro('Your weekly plan was updated.')}`, {
      subject: 'Your weekly plan',
      preview: 'Your weekly plan was updated.',
    }),
    text: `Update, ${name}\n\nYour weekly plan was updated.`,
  };
}

function renderSubscriptionHolidaySkipEmail({
  firstName,
  skippedSunday,
  nextSunday,
  chargeLabel,
  owner = false,
} = {}) {
  const vars = {
    firstName: firstName || 'there',
    skippedSunday: skippedSunday || 'this Sunday',
    nextSunday: nextSunday || 'the next Sunday',
    chargeLabel: chargeLabel || PAUSE_CANCEL_BY,
  };
  if (owner) {
    const c = COPY.ownerHoliday;
    const subject = fill(c.subject, vars);
    const html = ownerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${intro(fill(c.intro, vars))}
    `, { subject });
    return { subject, html, text: `${c.heading}\n\n${fill(c.intro, vars)}\n` };
  }
  const c = COPY.holiday;
  const subject = fill(c.subject, vars);
  const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(fill(c.heading, vars))}
      ${intro(fill(c.intro, vars).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}
  `, { subject, preview: fill(c.preview, vars) });
  return { subject, html, text: `${mdText(fill(c.heading, vars))}\n\n${mdText(fill(c.intro, vars))}\n` };
}

function renderSubscriptionWednesdayEmail({
  firstName,
  mealCount,
  delivery,
  deliveryLabel,
  pickupSlot,
  cutoffLabel,
  charged = false,
  planCents = 0,
  deliveryCents = 0,
  chargedCents = 0,
  meals,
  addons,
  subscriptionId,
  cardBrand,
  last4,
} = {}) {
  const vars = {
    firstName: firstName || 'there',
    fulfillmentDate: deliveryLabel || 'Sunday',
    cutoffDateTime: cutoffLabel,
  };
  const c = COPY.wednesday;
  const subject = c.subject;
  const mealsHref = appUrl(`/my-subscriptions/${subscriptionId || ''}/meals`);
  const addonsHref = appUrl(`/my-subscriptions/${subscriptionId || ''}/addons`);
  const money = charged && last4
    ? chargedPlanLine({ planCents, deliveryCents, chargedCents, cardBrand, last4 })
    : '';
  const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(fill(c.heading, vars))}
      ${intro(fill(c.intro, vars).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}
      ${h2('Meals')}
      ${itemListHtml(meals, 'None yet — pick them before cutoff and we will have them ready.')}
      ${h2('Add-ons')}
      ${itemListHtml(addons, 'None yet.')}
      ${money ? bodyP(money) : ''}
      ${bodyP(c.swap)}
      ${bodyP(c.extras)}
      ${ctaPair(mealsHref, CTA.changeMeals, addonsHref, CTA.addExtras)}
  `, { subject, preview: c.preview });
  const text = [
    mdText(fill(c.heading, vars)),
    '',
    mdText(fill(c.intro, vars)),
    '',
    'Meals',
    itemLinesText(meals) || 'None yet.',
    '',
    'Add-ons',
    itemLinesText(addons) || 'None yet.',
    money ? `\n${mdText(money)}\n` : '',
    c.swap,
    '',
    mdText(c.extras),
    '',
    `${CTA.changeMeals}: ${mealsHref}`,
    `${CTA.addExtras}: ${addonsHref}`,
  ].join('\n');
  return { subject, html, text };
}

function renderSubscriptionThursdayEmail({
  firstName,
  mealCount,
  delivery,
  deliveryLabel,
  pickupSlot,
  address,
  chargedAddons = false,
  addonCents = 0,
  chargedCents = 0,
  addonItems,
  meals,
  cardBrand,
  last4,
  notes,
} = {}) {
  const sunday = deliveryLabel || 'Sunday';
  const weekday = weekdayFromLabel(sunday);
  const c = COPY.thursday;
  const subject = c.subject;
  const boxLine = nextBoxValue({ delivery, pickupSlot, fulfillmentDate: sunday });
  const note = String(notes || address || '').trim();
  const loc = delivery ? (address || note || '—') : PICKUP_ADDRESS;
  const extrasLine = chargedAddons && last4
    ? chargedExtrasLine({
      extrasTotal: formatDollars(chargedCents || addonCents),
      cardBrand,
      last4,
    })
    : '';
  const fulfillHtml = delivery
    ? card(kvTable(`
        ${kvRow('Next box', boxLine)}
        ${kvRow('Delivery Address', loc)}
        ${kvRow('Notes', note || loc, { last: true })}
      `))
    : card(kvTable(`
        ${kvRow('Next box', boxLine)}
        ${kvRow('Address', PICKUP_ADDRESS, { last: true })}
      `));
  const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(fill(c.heading, { weekday }))}
      ${intro(c.intro)}
      ${h2('Meals')}
      ${itemListHtml(meals, '—')}
      ${h2('Extras')}
      ${itemListHtml(addonItems, 'None this week.')}
      ${fulfillHtml}
      ${extrasLine ? bodyP(extrasLine) : ''}
  `, { subject, preview: c.preview });
  const text = [
    fill(c.heading, { weekday }),
    '',
    c.intro,
    '',
    itemLinesText(meals) || '—',
    itemLinesText(addonItems) || 'None this week.',
    '',
    `Next box: ${boxLine}`,
    delivery ? `Delivery Address: ${loc}\nNotes: ${note || loc}` : `Address: ${PICKUP_ADDRESS}`,
    extrasLine ? `\n${extrasLine}` : '',
  ].join('\n');
  return { subject, html, text };
}

function renderOwnerThursdayLockEmail({ sunday, boxes = [] } = {}) {
  const pickup = boxes.filter((row) => !row.delivery);
  const delivery = boxes.filter((row) => row.delivery);
  const ordered = [...pickup, ...delivery];
  const vars = {
    fulfillmentDate: sunday || 'Sunday',
    planCount: ordered.length,
  };
  const c = COPY.ownerThursday;
  const subject = fill(c.subject, vars);
  const pickupCount = pickup.length;
  const deliveryCount = delivery.length;
  const block = (row, i) => {
    const notes = String(row.notes || '').trim();
    const extras = itemLinesHtml(row.extras);
    const loc = row.address || (row.delivery ? '—' : PICKUP_ADDRESS);
    const boxLine = `${row.method} ${sunday || 'Sunday'}, ${row.windowStart} – ${row.windowEnd}`;
    const place = row.delivery
      ? `<p style="margin:0 0 6px; font-size:14px; color:${C_INK}; font-family:${FONT};"><strong>Delivery Address:</strong> ${loc}</p>
      <p style="margin:0 0 10px; font-size:14px; color:${C_INK}; font-family:${FONT};"><strong>Notes:</strong> ${notes || loc}</p>`
      : `<p style="margin:0 0 6px; font-size:14px; color:${C_INK}; font-family:${FONT};">${PICKUP_ADDRESS}</p>
      ${notes ? `<p style="margin:0 0 10px; padding:8px 10px; background-color:${C_CREAM}; font-size:14px; color:${C_INK}; font-family:${FONT};"><strong>Notes:</strong> ${notes}</p>` : ''}`;
    return `
    <div class="owner-box" style="break-inside:avoid; page-break-inside:avoid; margin:0 0 24px; padding:16px 0; border-top:1px solid ${C_LINE};">
      <p style="margin:0 0 8px; font-size:16px; font-weight:700; color:${C_INK}; font-family:${FONT};">${i}. ${row.name} — ${row.mealCount} meals</p>
      <p style="margin:0 0 6px; font-size:14px; color:${C_INK}; font-family:${FONT};">${boxLine}</p>
      <p style="margin:0 0 10px; font-size:14px; color:${C_MUTED}; font-family:${FONT};">${row.phone || '—'} · ${row.email || '—'}</p>
      ${place}
      <p style="margin:0 0 6px; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};">${itemLinesHtml(row.meals) || '—'}</p>
      ${extras ? `<p style="margin:0; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};"><strong>Extras:</strong><br/>${extras}</p>` : ''}
    </div>`;
  };
  const html = ownerWrap(`
      ${eyebrow('Kitchen')}
      ${h1(fill(c.heading, vars))}
      ${intro(`<strong>${ordered.length} plans</strong> · ${pickupCount} pickup, ${deliveryCount} delivery`)}
      ${ordered.map((row, i) => block(row, i + 1)).join('')}
  `, {
    subject,
    extraCss: '.owner-box { break-inside: avoid; page-break-inside: avoid; }',
  });
  const textLines = ordered.map((row, i) => {
    const notes = String(row.notes || '').trim();
    const loc = row.address || (row.delivery ? '—' : PICKUP_ADDRESS);
    return [
      `${i + 1}. ${row.name} — ${row.mealCount} meals`,
      `${row.method} ${sunday || 'Sunday'}, ${row.windowStart} – ${row.windowEnd}`,
      `${row.phone || '—'} · ${row.email || '—'}`,
      row.delivery ? `Delivery Address: ${loc}` : `Address: ${PICKUP_ADDRESS}`,
      row.delivery ? `Notes: ${notes || loc}` : (notes ? `Notes: ${notes}` : ''),
      itemLinesText(row.meals) || '—',
      row.extras?.length ? `Extras:\n${itemLinesText(row.extras)}` : '',
    ].filter(Boolean).join('\n');
  });
  const text = `${subject}\n\n${ordered.length} plans · ${pickupCount} pickup, ${deliveryCount} delivery\n\n${textLines.join('\n\n')}\n`;
  return { subject, html, text };
}

function renderOwnerStatusEmail({
  kind,
  customerName,
  mealCount,
  price,
  dateTime,
  lastBoxDate,
  lastBoxPaid,
  weeks,
  lifetimeValue,
} = {}) {
  const name = customerName || 'Customer';
  const c = kind === 'cancelled' ? COPY.ownerCancelled : kind === 'resumed' ? COPY.ownerResumed : COPY.ownerPaused;
  const vars = { customerName: name, mealCount, price: price || formatDollars(0) };
  const subject = fill(c.subject, vars);
  const last = lastBoxDate
    ? `Last box: ${lastBoxDate}${lastBoxPaid ? ' (already paid)' : ''}.`
    : '';
  const html = ownerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${h2(`${name} — ${mealCount} meals a week`)}
      ${intro(`${kind === 'cancelled' ? 'Cancelled' : kind === 'resumed' ? 'Resumed' : 'Paused'} ${dateTime || 'just now'}. ${last}`)}
      ${card(kvTable(`
        ${kvRow('Subscriber for', `${weeks || 1} week${Number(weeks) === 1 ? '' : 's'}`)}
        ${kvRow('Lifetime', lifetimeValue || formatDollars(0), { last: true })}
      `))}
      ${ctaLink(adminHref(), CTA.viewCustomer)}
  `, { subject });
  const text = `${subject}\n\n${name} — ${mealCount} meals a week\n${last}\nSubscriber for ${weeks || 1} weeks · ${lifetimeValue || formatDollars(0)} lifetime\n`;
  return { subject, html, text };
}

function renderOwnerPlanChangedEmail({
  customerName,
  oldMealCount,
  newMealCount,
  oldPriceCents,
  newPriceCents,
  oldPrice,
  newPrice,
  effectiveDate,
  selectedCount,
} = {}) {
  const diffMeals = Number(newMealCount) - Number(oldMealCount);
  const signedMeals = diffMeals >= 0 ? `+${diffMeals}` : String(diffMeals);
  const oldC = Number(oldPriceCents) || 0;
  const newC = Number(newPriceCents) || 0;
  const moneyDiff = newC - oldC;
  const signedDiff = `${moneyDiff >= 0 ? '+' : '−'}${formatDollars(Math.abs(moneyDiff))}`;
  const oldLabel = oldPrice || formatDollars(oldC);
  const newLabel = newPrice || formatDollars(newC);
  const remaining = Math.max(0, Number(newMealCount) - Number(selectedCount || 0));
  const vars = {
    customerName,
    oldMealCount,
    newMealCount,
    signedDiff,
  };
  const c = COPY.ownerPlan;
  const subject = fill(c.subject, vars);
  const pick = remaining > 0
    ? `${selectedCount || 0} of ${newMealCount} (${remaining} still to pick)`
    : `${selectedCount || 0} of ${newMealCount}`;
  const html = ownerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${intro(`<strong>${customerName}</strong> — ${oldMealCount} meals → <strong>${newMealCount} meals a week</strong>`)}
      ${card(kvTable(`
        ${kvRow('Price', `${oldLabel} → ${newLabel}/week`)}
        ${kvRow('Effective', `${effectiveDate} · ${signedMeals} meals to the prep count`)}
        ${kvRow('Meals selected', pick, { last: true })}
      `))}
      ${ctaLink(adminHref(), CTA.viewSubscription)}
  `, { subject });
  const text = `${subject}\n\n${customerName} — ${oldMealCount} → ${newMealCount} meals a week\n${oldLabel} → ${newLabel}/week\nEffective ${effectiveDate}\nMeals selected — ${pick}\n`;
  return { subject, html, text };
}

function renderOwnerFulfillmentEmail({
  customerName,
  oldMethod,
  newMethod,
  fulfillmentDate,
  address,
  windowStart,
  windowEnd,
} = {}) {
  const vars = { method: newMethod, customerName, fulfillmentDate };
  const c = COPY.ownerFulfillment;
  const subject = fill(c.subject, vars);
  const html = ownerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${intro(`<strong>${customerName}</strong> — ${oldMethod} → <strong>${newMethod}</strong>`)}
      ${card(kvTable(`
        ${kvRow('Next box', `${newMethod === 'delivery' ? 'Delivery' : 'Pickup'} ${fulfillmentDate}, ${windowStart} – ${windowEnd}`)}
        ${newMethod === 'delivery'
          ? `${kvRow('Delivery Address', address || '—')}${kvRow('Notes', address || '—', { last: true })}`
          : `${kvRow('Address', PICKUP_ADDRESS, { last: true })}`}
      `))}
      ${ctaLink(adminHref(), CTA.viewSubscription)}
  `, { subject });
  const text = `${subject}\n\n${customerName} — ${oldMethod} → ${newMethod}\n${newMethod === 'delivery' ? 'Delivery' : 'Pickup'} ${fulfillmentDate}, ${windowStart} – ${windowEnd}\n${newMethod === 'delivery' ? `Delivery Address: ${address || '—'}\nNotes: ${address || '—'}` : `Address: ${PICKUP_ADDRESS}`}\n`;
  return { subject, html, text };
}

function renderOwnerPaymentFailedEmail({
  customerName,
  amount,
  fulfillmentDate,
  cardBrand,
  last4,
  declineReason,
  dateTime,
  cutoffDateTime,
} = {}) {
  const c = COPY.ownerPaymentFailed;
  const subject = fill(c.subject, { customerName, amount });
  const html = ownerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(c.heading)}
      ${intro(`<strong>${customerName} — ${amount} for ${fulfillmentDate}</strong>`)}
      ${card(kvTable(`
        ${kvRow('Card', `${formatCardBrand(cardBrand)} •••• ${last4}`)}
        ${kvRow('Declined', `${declineReason || 'card_declined'} · ${dateTime || ''}`, { last: true })}
      `))}
      ${bodyP('The plan is paused until they add a new card. This Sunday\'s box will not go out.')}
      ${ctaLink(adminHref(), CTA.viewSubscription)}
  `, { subject });
  const text = `${subject}\n\n${customerName} — ${amount} for ${fulfillmentDate}\n${formatCardBrand(cardBrand)} •••• ${last4} · declined (${declineReason || 'card_declined'}) · ${dateTime || ''}\nThe plan is paused until they add a new card. This Sunday's box will not go out.\n`;
  return { subject, html, text };
}

function renderSubscriptionPriceEmail({
  firstName,
  mealCount,
  oldPriceCents,
  newPriceCents,
  chargeLabel,
} = {}) {
  const name = firstName || 'there';
  const planWeek = mealsAWeek(mealCount);
  const charge = chargeLabel || PAUSE_CANCEL_BY;
  const subject = `Your ${planWeek} is now ${formatDollars(newPriceCents)}/week`;
  const introText = `Your ${planWeek} is changing from ${formatDollars(oldPriceCents)} to ${formatDollars(newPriceCents)} per week (before tax). The new price applies at the next ${charge} charge — this Sunday stays at the amount already billed if you already paid.`;
  const html = customerWrap(`
      ${eyebrow('Weekly subscription')}
      ${h1(`Price update, ${name}`)}
      ${intro(introText)}
      ${ctaLink(appUrl('/my-subscriptions'), CTA.manage)}
  `, { subject, preview: subject });
  const text = `Price update, ${name}\n\n${introText}\n\n${CTA.manage}: ${appUrl('/my-subscriptions')}\n`;
  return { subject, html, text };
}

module.exports = {
  renderSubscriptionWelcomeEmail,
  renderOwnerSubscriptionEmail,
  renderSubscriptionUpdatedEmail,
  renderSubscriptionManageEmail,
  renderSubscriptionHolidaySkipEmail,
  renderOwnerThursdayLockEmail,
  renderSubscriptionWednesdayEmail,
  renderSubscriptionThursdayEmail,
  renderSubscriptionPriceEmail,
  renderOwnerStatusEmail,
  renderOwnerPlanChangedEmail,
  renderOwnerFulfillmentEmail,
  renderOwnerPaymentFailedEmail,
};
