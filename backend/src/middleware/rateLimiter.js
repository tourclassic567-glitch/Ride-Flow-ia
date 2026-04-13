const rateLimit = require('express-rate-limit');

/**
 * General rate limiter: 100 requests per minute per IP.
 * Applied to all /api/v1 routes.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

module.exports = { apiLimiter };
