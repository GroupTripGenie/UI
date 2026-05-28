const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const pool    = require('../db');
const auth    = require('../middleware/auth');

// ── Helper ────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, full_name } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password and full_name are required' });
  }
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, avatar_initials, created_at`,
      [email, password_hash, full_name]
    );
    const user  = rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND provider = $2',
      [email, 'local']
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(user);
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, avatar_initials, avatar_url,
              preferred_currency, preferred_timezone, provider, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/auth/me ────────────────────────────────────────
router.patch('/me', auth, async (req, res) => {
  const { full_name, preferred_currency, preferred_timezone, avatar_url } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET full_name           = COALESCE($1, full_name),
           preferred_currency  = COALESCE($2, preferred_currency),
           preferred_timezone  = COALESCE($3, preferred_timezone),
           avatar_url          = COALESCE($4, avatar_url)
       WHERE id = $5
       RETURNING id, email, full_name, avatar_initials, avatar_url,
                 preferred_currency, preferred_timezone, created_at`,
      [full_name || null, preferred_currency || null,
       preferred_timezone || null, avatar_url || null, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    const { rows } = await pool.query(
      'SELECT id, full_name FROM users WHERE email = $1 AND provider = $2',
      [email, 'local']
    );

    // Always return success to prevent email enumeration
    if (!rows[0]) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const user  = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Store token in DB
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3`,
      [user.id, token, expires]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://tripgenie-u0be.onrender.com';
    const resetLink   = `${frontendUrl}/reset-password.html?token=${token}`;

    // Send email via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from:    'TripGenie <onboarding@resend.dev>',
        to:      [email],
        subject: '🧞 Reset your TripGenie password',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="width:48px;height:48px;background:linear-gradient(135deg,#063937,#068cdf);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:24px">🧞</div>
              <h1 style="color:#063937;font-size:22px;margin:12px 0 4px">Reset your password</h1>
              <p style="color:#64748b;font-size:14px">Hi ${user.full_name}, we got your request!</p>
            </div>
            <p style="color:#475569;font-size:14px;line-height:1.6">Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${resetLink}" style="background:linear-gradient(135deg,#068cdf,#063937);color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
                Reset Password →
              </a>
            </div>
            <p style="color:#94a3b8;font-size:12px;text-align:center">If you did not request this, you can safely ignore this email.<br/>Your password will not change.</p>
          </div>
        `
      })
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      console.error('Resend error:', JSON.stringify(resendData));
    } else {
      console.log('Email sent successfully:', resendData.id);
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM password_reset_tokens
       WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    const password_hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, rows[0].user_id]);
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [rows[0].user_id]);

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


// ── Helper ────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, full_name } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password and full_name are required' });
  }
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, avatar_initials, created_at`,
      [email, password_hash, full_name]
    );
    const user  = rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND provider = $2',
      [email, 'local']
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(user);
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, avatar_initials, avatar_url,
              preferred_currency, preferred_timezone, provider, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/auth/me ────────────────────────────────────────
router.patch('/me', auth, async (req, res) => {
  const { full_name, preferred_currency, preferred_timezone, avatar_url } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET full_name           = COALESCE($1, full_name),
           preferred_currency  = COALESCE($2, preferred_currency),
           preferred_timezone  = COALESCE($3, preferred_timezone),
           avatar_url          = COALESCE($4, avatar_url)
       WHERE id = $5
       RETURNING id, email, full_name, avatar_initials, avatar_url,
                 preferred_currency, preferred_timezone, created_at`,
      [full_name || null, preferred_currency || null,
       preferred_timezone || null, avatar_url || null, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;