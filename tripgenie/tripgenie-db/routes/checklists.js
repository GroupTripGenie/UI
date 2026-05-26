const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

// ═══════════════════════════════════════════════════════════════
//  CHECKLISTS
// ═══════════════════════════════════════════════════════════════

// ── GET /api/checklists?tripId=xxx ────────────────────────────
router.get('/checklists', async (req, res) => {
  const { tripId } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
              json_agg(ci.* ORDER BY ci.sort_order) FILTER (WHERE ci.id IS NOT NULL) AS items
       FROM checklists c
       LEFT JOIN checklist_items ci ON ci.checklist_id = c.id
       JOIN trips t ON t.id = c.trip_id AND t.user_id = $1
       WHERE ($2::uuid IS NULL OR c.trip_id = $2)
       GROUP BY c.id
       ORDER BY c.created_at`,
      [req.user.id, tripId || null]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/checklists ──────────────────────────────────────
router.post('/checklists', async (req, res) => {
  const { trip_id, title, icon } = req.body;
  if (!trip_id || !title) return res.status(400).json({ error: 'trip_id and title are required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO checklists (trip_id, title, icon) VALUES ($1,$2,$3) RETURNING *`,
      [trip_id, title, icon || '📋']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/checklists/:id/items ───────────────────────────
router.post('/checklists/:id/items', async (req, res) => {
  const { label, sort_order } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO checklist_items (checklist_id, label, sort_order) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, label, sort_order || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/checklists/items/:itemId ──────────────────────
// Toggle checked or update label
router.patch('/checklists/items/:itemId', async (req, res) => {
  const { is_checked, label } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE checklist_items
       SET is_checked = COALESCE($1, is_checked),
           label      = COALESCE($2, label)
       WHERE id = $3 RETURNING *`,
      [is_checked ?? null, label || null, req.params.itemId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/checklists/:id ────────────────────────────────
router.delete('/checklists/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM checklists WHERE id = $1', [req.params.id]);
    res.json({ message: 'Checklist deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  REMINDERS
// ═══════════════════════════════════════════════════════════════

// ── GET /api/reminders ────────────────────────────────────────
router.get('/reminders', async (req, res) => {
  const { tripId, done } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM reminders
       WHERE user_id = $1
         AND ($2::uuid IS NULL OR trip_id = $2)
         AND ($3::boolean IS NULL OR is_done = $3)
       ORDER BY remind_at ASC`,
      [req.user.id, tripId || null, done !== undefined ? done === 'true' : null]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/reminders ───────────────────────────────────────
router.post('/reminders', async (req, res) => {
  const { trip_id, title, description, remind_at, priority, category } = req.body;
  if (!title || !remind_at) return res.status(400).json({ error: 'title and remind_at are required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO reminders (user_id, trip_id, title, description, remind_at, priority, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, trip_id || null, title, description, remind_at, priority || 'medium', category]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/reminders/:id ──────────────────────────────────
router.patch('/reminders/:id', async (req, res) => {
  const { is_done, title, remind_at, priority } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE reminders
       SET is_done   = COALESCE($1, is_done),
           done_at   = CASE WHEN $1 = true THEN NOW() ELSE done_at END,
           title     = COALESCE($2, title),
           remind_at = COALESCE($3, remind_at),
           priority  = COALESCE($4, priority)
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [is_done ?? null, title || null, remind_at || null, priority || null, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Reminder not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/reminders/:id ─────────────────────────────────
router.delete('/reminders/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM reminders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ message: 'Reminder deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── DELETE /api/checklists/items/:itemId ──────────────────────
router.delete('/checklists/items/:itemId', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM checklist_items WHERE id = $1',
      [req.params.itemId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
