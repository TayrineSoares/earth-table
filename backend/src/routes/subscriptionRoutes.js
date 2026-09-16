const express = require('express');
const router = express.Router();

const {
  SubscriptionError,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getSettings,
  updateSettings,
} = require('../queries/subscription');

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
