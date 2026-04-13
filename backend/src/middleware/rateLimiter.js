/**
 * Global rate limiter – 100 requests per minute per IP.
 * Applied to all routes in app.js.
 */
const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 100,                   // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests – please try again in a minute.' },
});
