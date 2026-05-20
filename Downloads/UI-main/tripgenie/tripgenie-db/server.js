require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const pool      = require('./db');

const authRoutes      = require('./routes/auth');
const tripRoutes      = require('./routes/trips');
const budgetRoutes    = require('./routes/budget');
const checklistRoutes = require('./routes/checklists');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/trips',  tripRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/checklists', checklistRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ── 404 fallback ─────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`TripGenie API running → http://localhost:${PORT}`);
});