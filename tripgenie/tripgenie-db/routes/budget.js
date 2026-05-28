const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

// ── GET /api/budget/:tripId ───────────────────────────────────
// Returns budget + categories with live spending totals
router.get('/:tripId', async (req, res) => {
  try {
    // Verify trip belongs to user
    const trip = await pool.query(
      'SELECT id FROM trips WHERE id = $1 AND user_id = $2',
      [req.params.tripId, req.user.id]
    );
    if (!trip.rows[0]) return res.status(404).json({ error: 'Trip not found' });

    const budget = await pool.query(
      'SELECT * FROM budgets WHERE trip_id = $1',
      [req.params.tripId]
    );
    if (!budget.rows[0]) return res.json(null);

    const categories = await pool.query(
      'SELECT * FROM category_spending WHERE budget_id = $1 ORDER BY name',
      [budget.rows[0].id]
    );

    res.json({ ...budget.rows[0], categories: categories.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/budget/:tripId ──────────────────────────────────
router.post('/:tripId', async (req, res) => {
  const { total_amount, currency = 'USD' } = req.body;
  if (!total_amount) return res.status(400).json({ error: 'total_amount is required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO budgets (trip_id, total_amount, currency)
       VALUES ($1,$2,$3)
       ON CONFLICT (trip_id) DO UPDATE SET total_amount=$2, currency=$3
       RETURNING *`,
      [req.params.tripId, total_amount, currency]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/budget/:tripId/categories ──────────────────────
router.post('/:tripId/categories', async (req, res) => {
  const { name, allocated, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const budget = await pool.query(
      'SELECT id FROM budgets WHERE trip_id = $1', [req.params.tripId]
    );
    if (!budget.rows[0]) return res.status(404).json({ error: 'Budget not found for this trip' });

    const { rows } = await pool.query(
      `INSERT INTO budget_categories (budget_id, name, allocated, color)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [budget.rows[0].id, name, allocated || 0, color || '#068cdf']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/budget/:tripId/categories/:catId ───────────────
router.patch('/:tripId/categories/:catId', async (req, res) => {
  const { name, allocated, color } = req.body;
  if (!name && allocated === undefined && !color) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    // Verify the category belongs to this trip's budget (security check)
    const check = await pool.query(
      `SELECT bc.id FROM budget_categories bc
       JOIN budgets b ON b.id = bc.budget_id
       WHERE bc.id = $1 AND b.trip_id = $2`,
      [req.params.catId, req.params.tripId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'Category not found' });

    const { rows } = await pool.query(
      `UPDATE budget_categories
       SET name      = COALESCE($1, name),
           allocated = COALESCE($2, allocated),
           color     = COALESCE($3, color)
       WHERE id = $4
       RETURNING *`,
      [name || null, allocated ?? null, color || null, req.params.catId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/budget/:tripId/categories/:catId ──────────────
router.delete('/:tripId/categories/:catId', async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT bc.id FROM budget_categories bc
       JOIN budgets b ON b.id = bc.budget_id
       WHERE bc.id = $1 AND b.trip_id = $2`,
      [req.params.catId, req.params.tripId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'Category not found' });

    await pool.query('DELETE FROM budget_categories WHERE id = $1', [req.params.catId]);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/budget/:tripId/expenses ─────────────────────────
router.get('/:tripId/expenses', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, bc.name AS category_name, bc.color AS category_color
       FROM expenses e
       JOIN budget_categories bc ON bc.id = e.category_id
       WHERE e.trip_id = $1
       ORDER BY e.spent_on DESC`,
      [req.params.tripId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/budget/:tripId/expenses ─────────────────────────
router.post('/:tripId/expenses', async (req, res) => {
  const { category_id, description, amount, spent_on, receipt_url } = req.body;
  if (!category_id || !description || !amount) {
    return res.status(400).json({ error: 'category_id, description and amount are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO expenses (category_id, trip_id, description, amount, spent_on, receipt_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [category_id, req.params.tripId, description, amount, spent_on || new Date(), receipt_url]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/budget/:tripId/expenses/:expenseId ─────────────
router.patch('/:tripId/expenses/:expenseId', async (req, res) => {
  const { description, amount, spent_on, category_id } = req.body;
  if (!description && amount === undefined && !spent_on && !category_id) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE expenses
       SET description = COALESCE($1, description),
           amount      = COALESCE($2, amount),
           spent_on    = COALESCE($3, spent_on),
           category_id = COALESCE($4, category_id)
       WHERE id = $5 AND trip_id = $6
       RETURNING *`,
      [description || null, amount ?? null, spent_on || null, category_id || null,
       req.params.expenseId, req.params.tripId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Expense not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/budget/:tripId/expenses/:expenseId ────────────
router.delete('/:tripId/expenses/:expenseId', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM expenses WHERE id = $1 AND trip_id = $2',
      [req.params.expenseId, req.params.tripId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
