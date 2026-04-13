require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rideRoutes = require('./routes/ride');
const pricingRoutes = require('./routes/pricing');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const agentRoutes = require('./routes/agents');
const servicesRoutes = require('./routes/services');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');
const adminAuth = require('./middleware/adminAuth');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

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

// API v1 – rate-limited
app.use('/api/v1', apiLimiter);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/admin', adminAuth, adminRoutes);

app.use(errorHandler);

module.exports = app;
