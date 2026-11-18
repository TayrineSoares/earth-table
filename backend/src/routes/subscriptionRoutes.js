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
  discontinuePlan,
} = require('../queries/subscriptionManage');
const { runPlanCharge, runMealLock } = require('../queries/subscriptionCharge');
const { requireAdminOrCron, cronAuthorized } = require('../middleware/requireAdminOrCron');
const { requireAdmin, requireAuth, unlessPublic, optionalAuth } = require('../middleware/requireAuth');

function handleError(res, err, label) {
  if (err instanceof SubscriptionError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(label, err);
  return res.status(500).json({ error: err.message || 'Server error' });
}

/** Body userId if present must match the Bearer user; always return req.user.id. */
function resolveCallerUserId(req) {
  const fromBody = req.body?.userId;
  if (
    fromBody != null
    && String(fromBody).trim() !== ''
    && String(fromBody) !== String(req.user.id)
  ) {
    throw new SubscriptionError(400, 'userId does not match the signed-in user.');
  }
  return req.user.id;
}

const PUBLIC = [
  { method: 'GET', pattern: /^\/plans(\/|$)/ },
  { method: 'GET', path: '/dates' },
  { method: 'GET', pattern: /^\/signup\// },
  { method: 'GET', pattern: /^\/card-setup\// },
];

function requireAuthUnlessCronJob(req, res, next) {
  if (
    (req.path === '/admin/run-charge' || req.path === '/admin/run-lock')
    && cronAuthorized(req)
  ) {
    next();
    return;
  }
  return requireAuth(req, res, next);
}

// Default-deny: auth required except public catalog/capability URLs (and cron charge/lock).
router.use(unlessPublic(PUBLIC, requireAuthUnlessCronJob));

// GET /subscriptions/plans?active=1 — public marketing catalog
// GET /subscriptions/plans — admin Bearer; includes inactive + subscriber_count
router.get(
  '/plans',
  optionalAuth,
  (req, res, next) => {
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    req.plansActiveOnly = activeOnly;
    if (activeOnly) return next();
    return requireAdmin(req, res, next);
  },
  async (req, res) => {
    try {
      const activeOnly = !!req.plansActiveOnly;
      const plans = await listPlans({ activeOnly });
      if (activeOnly) {
        return res.json(plans.map(({ subscriber_count, ...plan }) => plan));
      }
      res.json(plans);
    } catch (err) {
      handleError(res, err, '[GET /subscriptions/plans]');
    }
  }
);

router.get(
  '/plans/:id',
  optionalAuth,
  async (req, res, next) => {
    try {
      const plan = await getPlanById(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found.' });
      }
      req.planRow = plan;
      if (plan.is_active) return next();
      return requireAdmin(req, res, next);
    } catch (err) {
      handleError(res, err, '[GET /subscriptions/plans/:id]');
    }
  },
  async (req, res) => {
    const plan = req.planRow;
    if (plan.is_active) {
      const { subscriber_count, ...publicPlan } = plan;
      return res.json(publicPlan);
    }
    res.json(plan);
  }
);

// Register /mine before any /:id routes.
router.get('/mine', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const rows = await listMine(req.user.id);
    res.json(rows);
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/mine]');
  }
});

router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const rows = await listAll();
    res.json(rows);
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/admin]');
  }
});

router.post('/admin/run-charge', requireAdminOrCron, async (req, res) => {
  try {
    const result = await runPlanCharge({ force: true });
    res.json(result);
  } catch (err) {
    handleError(res, err, '[POST /subscriptions/admin/run-charge]');
  }
});

router.post('/admin/run-lock', requireAdminOrCron, async (req, res) => {
  try {
    const result = await runMealLock({ force: true });
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
    const userId = resolveCallerUserId(req);
    const result = await createSubscriptionCheckout({ ...(req.body || {}), userId });
    res.json(result);
  } catch (err) {
    handleError(res, err, '[POST /subscriptions/checkout]');
  }
});

router.post('/:id/card-setup', async (req, res) => {
  try {
    const userId = resolveCallerUserId(req);
    const result = await createCardSetupCheckout(userId, req.params.id);
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
    const userId = resolveCallerUserId(req);
    const result = await replaceOpenCyclePlanAndAddons(
      userId,
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
    const userId = resolveCallerUserId(req);
    const result = await updateOpenCycleFulfillment(
      userId,
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
    const userId = resolveCallerUserId(req);
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
    const userId = resolveCallerUserId(req);
    const result = await changeSubscriptionPlan(
      userId,
      req.params.id,
      req.body?.planId,
      { meals: req.body?.meals, addons: req.body?.addons }
    );
    res.json(result);
  } catch (err) {
    handleError(res, err, '[PATCH /subscriptions/:id/plan]');
  }
});

router.post('/plans', requireAdmin, async (req, res) => {
  try {
    const plan = await createPlan(req.body || {});
    res.status(201).json(plan);
  } catch (err) {
    handleError(res, err, '[POST /subscriptions/plans]');
  }
});

router.patch('/plans/:id', requireAdmin, async (req, res) => {
  try {
    const result = await updatePlan(req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    handleError(res, err, '[PATCH /subscriptions/plans/:id]');
  }
});

router.post('/plans/:id/discontinue', requireAdmin, async (req, res) => {
  try {
    const result = await discontinuePlan(req.params.id);
    res.json(result);
  } catch (err) {
    handleError(res, err, '[POST /subscriptions/plans/:id/discontinue]');
  }
});

// Public: next Wednesday 5pm meal lock (or test_lock_at), first delivery Sunday, save-up-to %
router.get('/dates', async (req, res) => {
  try {
    const info = await getPublicSignupInfo();
    res.json(info);
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/dates]');
  }
});

router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings || {});
  } catch (err) {
    handleError(res, err, '[GET /subscriptions/settings]');
  }
});

router.patch('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await updateSettings(req.body || {});
    res.json(settings);
  } catch (err) {
    handleError(res, err, '[PATCH /subscriptions/settings]');
  }
});

module.exports = router;
