const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../db');

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS);
  return `${salt}:${key.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, keyHex] = stored.split(':');
    const key = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS);
    return crypto.timingSafeEqual(Buffer.from(keyHex, 'hex'), key);
  } catch {
    return false;
  }
}

// POST /auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = hashPassword(password);

    const result = await db.query(
      `SELECT id, email, role, password_hash FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result && result.rows.length > 0) {
      const user = result.rows[0];
      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      return res.json({ id: user.id, email: user.email, role: user.role });
    }

    // Try to register user if not found (auto-register for MVP)
    const insertResult = await db.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, role`,
      [email.toLowerCase(), passwordHash, role || 'passenger']
    );

    if (insertResult && insertResult.rows.length > 0) {
      const user = insertResult.rows[0];
      return res.json({ id: user.id, email: user.email, role: user.role });
    }

    // If email exists with different password
    if (insertResult && insertResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Mock mode: DB not available
    return res.json({
      id: Date.now(),
      email: email.toLowerCase(),
      role: role || 'passenger',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
