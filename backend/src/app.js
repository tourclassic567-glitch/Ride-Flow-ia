require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const rideRoutes = require('./routes/ride');
const pricingRoutes = require('./routes/pricing');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const agentRoutes = require('./routes/agents');
const errorHandler = require('./middleware/errorHandler');
const { ipBlockMiddleware } = require('./middleware/ipBlock');

const app = express();

// Trust the first proxy hop so req.ip reflects the real client IP
app.set('trust proxy', 1);

// Global rate limiter — 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

app.use(globalLimiter);
app.use(ipBlockMiddleware);
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.use('/auth', authRoutes);
app.use('/ride', rideRoutes);
app.use('/pricing', pricingRoutes);
app.use('/bookings', bookingRoutes);
app.use('/agents', agentRoutes);

app.use(errorHandler);

module.exports = app;
