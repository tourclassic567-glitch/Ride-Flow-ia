require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rideRoutes = require('./routes/ride');
const pricingRoutes = require('./routes/pricing');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const agentRoutes = require('./routes/agents');
const servicesRoutes = require('./routes/v1/services');
const adminRoutes = require('./routes/v1/admin');
const errorHandler = require('./middleware/errorHandler');
const globalRateLimiter = require('./middleware/rateLimiter');
const adminAuth = require('./middleware/adminAuth');

const app = express();

app.use(cors());
app.use(express.json());
app.use(globalRateLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.use('/auth', authRoutes);
app.use('/ride', rideRoutes);
app.use('/pricing', pricingRoutes);
app.use('/bookings', bookingRoutes);
app.use('/agents', agentRoutes);

// v1 API
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/admin', adminAuth, adminRoutes);

app.use(errorHandler);

module.exports = app;
