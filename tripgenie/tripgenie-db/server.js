require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const passport  = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt       = require('jsonwebtoken');
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
app.use(passport.initialize());

// ── Google OAuth Strategy ─────────────────────────────────────
passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  `${process.env.BACKEND_URL || 'https://ui-production-e419.up.railway.app'}/api/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email     = profile.emails[0].value;
    const full_name = profile.displayName;
    const avatar    = profile.photos?.[0]?.value;

    // Upsert user
    const { rows } = await pool.query(
      `INSERT INTO users (email, full_name, provider, avatar_url)
       VALUES ($1, $2, 'google', $3)
       ON CONFLICT (email) DO UPDATE
       SET full_name  = EXCLUDED.full_name,
           avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
           provider   = CASE WHEN users.provider = 'local' THEN 'local' ELSE 'google' END
       RETURNING id, email, full_name, avatar_url, provider`,
      [email, full_name, avatar]
    );
    return done(null, rows[0]);
  } catch(err) {
    return done(err);
  }
}));

// ── Root ──────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ name: 'TripGenie API', status: 'ok' }));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch(e) {
    console.error('DB error:', e.message);
    res.status(500).json({ status: 'error', db: 'disconnected', message: e.message });
  }
});

// ── Google OAuth routes ───────────────────────────────────────
app.get('/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

app.get('/api/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login.html?error=google' }),
  (req, res) => {
    const user  = req.user;
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const frontendUrl = process.env.FRONTEND_URL || 'https://tripgenie-u0be.onrender.com';
    // Redirect to frontend with token in URL — frontend will store it
    res.redirect(`${frontendUrl}/auth-callback.html?token=${token}&user=${encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url }))}`);
  }
);

// ── Auth routes ───────────────────────────────────────────────
app.use('/api/auth',      authRoutes);

// ── Protected routes ──────────────────────────────────────────
app.use('/api/trips',     tripRoutes);
app.use('/api/budget',    budgetRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api',           checklistRoutes);

// ── 404 fallback ──────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, () => {
  console.log(`TripGenie API running → http://localhost:${PORT}`);
});

