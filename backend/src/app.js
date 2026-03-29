require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rideRoutes = require('./routes/ride');
const pricingRoutes = require('./routes/pricing');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const errorHandler = require('./middleware/errorHandler');

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

app.use(errorHandler);

module.exports = app;
