const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/auth');

// All routes require login
router.use(auth);

// ── GET /api/trips ────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM trips
       WHERE user_id = $1
         AND ($2::text IS NULL OR status = $2)
       ORDER BY start_date ASC NULLS LAST`,
      [req.user.id, status || null]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/trips/:id ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Trip not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/trips ───────────────────────────────────────────
router.post('/', async (req, res) => {
  const { title, destination, cover_image, start_date, end_date, notes } = req.body;

  if (!title || !destination) {
    return res.status(400).json({ error: 'title and destination are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO trips (user_id, title, destination, cover_image, start_date, end_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [req.user.id, title, destination, cover_image, start_date, end_date, notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/trips/:id ──────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const allowed = ['title','destination','cover_image','start_date','end_date','status','planning_pct','notes','itinerary'];
  const fields  = Object.keys(req.body).filter(k => allowed.includes(k));

  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });

  const sets   = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map(f => req.body[f]);

  try {
    const { rows } = await pool.query(
      `UPDATE trips SET ${sets} WHERE id = $${fields.length + 1} AND user_id = $${fields.length + 2} RETURNING *`,
      [...values, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Trip not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/trips/:id ─────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM trips WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Trip not found' });
    res.json({ message: 'Trip deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
