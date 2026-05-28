require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const pool      = require('./db');

const authRoutes      = require('./routes/auth');
const tripRoutes      = require('./routes/trips');
const budgetRoutes    = require('./routes/budget');
const checklistRoutes = require('./routes/checklists');
const assistantRoutes = require('./routes/assistant');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.options('*', cors());
app.use(express.json());

// ── Root ──────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ name: 'TripGenie API', status: 'ok' }));

// ── Health check FIRST (no auth) ──────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch(e) {
    console.error('DB error:', e.message);
    res.status(500).json({ status: 'error', db: 'disconnected', message: e.message });
  }
});

// ── Auth (no middleware) ──────────────────────────────────────
app.use('/api/auth',      authRoutes);

// ── Protected routes ─────────────────────────────────────────
app.use('/api/trips',     tripRoutes);
app.use('/api/budget',    budgetRoutes);
app.use('/api/assistant', assistantRoutes);

// ── Checklist + Reminder routes (mounted at /api) ─────────────
// These handle /api/checklists and /api/reminders internally
app.use('/api',           checklistRoutes);

// ── 404 fallback ──────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, () => {
  console.log(`TripGenie API running → http://localhost:${PORT}`);
});
