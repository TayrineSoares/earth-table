const express = require('express');
const router = express.Router();

const {
  SubscriptionError,
  listPlans,
  getPlanById,
  listMine,
  listAll,
  createPlan,
  updatePlan,
  deletePlan,
  getSettings,
  updateSettings,
  getPublicSignupInfo,
  replaceOpenCyclePlanAndAddons,
  updateOpenCycleFulfillment,
} = require('../queries/subscription');
const {
  createSubscriptionCheckout,
  getSignupBySessionId,
  createCardSetupCheckout,
  getCardSetupBySessionId,
} = require('../queries/subscriptionCheckout');
const {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
} = require('../queries/subscriptionManage');
const { runWednesdayCharge, runThursdayLock } = require('../queries/subscriptionCharge');

function handleError(res, err, label) {
  if (err instanceof SubscriptionError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(label, err);
  return res.status(500).json({ error: err.message || 'Server error' });
}

// GET /subscriptions/plans  (all, for admin)
// GET /subscriptions/plans?active=1  (marketing / signup)
router.get('/plans', async (req, res) => {
  try {
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    const plans = await listPlans({ activeOnly });
    res.json(plans);
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/plans]');
  }
});

router.get('/plans/:id', async (req, res) => {
  try {
    const plan = await getPlanById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found.' });
    }
    res.json(plan);
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/plans/:id]');
  }
});

router.get('/mine/:userId', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const rows = await listMine(req.params.userId);
    res.json(rows);
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/mine/:userId]');
  }
});

router.get('/admin', async (req, res) => {
  try {
    const rows = await listAll();
    res.json(rows);
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/admin]');
  }
});

router.post('/admin/run-charge', async (req, res) => {
  try {
    const result = await runWednesdayCharge({ force: true });
    res.json(result);
  } catch (err) {
    handleError(res, err, '[POST /subscriptions/admin/run-charge]');
  }
});

router.post('/admin/run-lock', async (req, res) => {
  try {
    const result = await runThursdayLock({ force: true });
    res.json(result);
  } catch (err) {
    handleError(res, err, '[POST /subscriptions/admin/run-lock]');
  }
});

router.get('/signup/:sessionId', async (req, res) => {
  try {
    const result = await getSignupBySessionId(req.params.sessionId);
    res.json(result);
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/signup/:sessionId]');
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const result = await createSubscriptionCheckout(req.body || {});
    res.json(result);
  } catch (err) {
    handleError(res, err, '[POST /subscriptions/checkout]');
  }
});

router.post('/:id/card-setup', async (req, res) => {
  try {
    const result = await createCardSetupCheckout(req.body?.userId, req.params.id);
    res.json(result);
  } catch (err) {
    handleError(res, err, '[POST /subscriptions/:id/card-setup]');
  }
});

router.get('/card-setup/:sessionId', async (req, res) => {
  try {
    const result = await getCardSetupBySessionId(req.params.sessionId);
    res.json(result);
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/card-setup/:sessionId]');
  }
});

router.patch('/:id/items', async (req, res) => {
  try {
    const result = await replaceOpenCyclePlanAndAddons(
      req.body?.userId,
      req.params.id,
      req.body?.meals,
      req.body?.addons
    );
    res.json(result);
  } catch (err) {
    handleError(res, err, '[PATCH /subscriptions/:id/items]');
  }
});

router.patch('/:id/fulfillment', async (req, res) => {
  try {
    const result = await updateOpenCycleFulfillment(
      req.body?.userId,
      req.params.id,
      req.body || {}
    );
    res.json(result);
  } catch (err) {
    handleError(res, err, '[PATCH /subscriptions/:id/fulfillment]');
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const action = String(req.body?.action || '').trim();
    const userId = req.body?.userId;
    const id = req.params.id;
    let result;
    if (action === 'pause') result = await pauseSubscription(userId, id);
    else if (action === 'resume') result = await resumeSubscription(userId, id);
    else if (action === 'cancel') result = await cancelSubscription(userId, id);
    else {
      return res.status(400).json({ error: 'Use pause, resume, or cancel.' });
    }
    res.json(result);
  } catch (err) {
    handleError(res, err, '[PATCH /subscriptions/:id/status]');
  }
});

router.patch('/:id/plan', async (req, res) => {
  try {
    const result = await changeSubscriptionPlan(
      req.body?.userId,
      req.params.id,
      req.body?.planId
    );
    res.json(result);
  } catch (err) {
    handleError(res, err, '[PATCH /subscriptions/:id/plan]');
  }
});

router.post('/plans', async (req, res) => {
  try {
    const plan = await createPlan(req.body || {});
    res.status(201).json(plan);
  } catch (err) {
    handleError(res, err, '[POST /subscriptions/plans]');
  }
});

router.patch('/plans/:id', async (req, res) => {
  try {
    const result = await updatePlan(req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    handleError(res, err, '[PATCH /subscriptions/plans/:id]');
  }
});

router.delete('/plans/:id', async (req, res) => {
  try {
    const result = await deletePlan(req.params.id);
    res.json(result);
  } catch (err) {
    handleError(res, err, '[DELETE /subscriptions/plans/:id]');
  }
});

// Public: next Thursday 5pm meal lock (or test_lock_at), first delivery Sunday, save-up-to %
router.get('/dates', async (req, res) => {
  try {
    const info = await getPublicSignupInfo();
    res.json(info);
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/dates]');
  }
});

router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings || {});
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/settings]');
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const settings = await updateSettings(req.body || {});
    res.json(settings);
  } catch (err) {
    handleError(res, err, '[PATCH /subscriptions/settings]');
  }
});

module.exports = router;
