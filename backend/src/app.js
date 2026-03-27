require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rideRoutes = require('./routes/ride');
const pricingRoutes = require('./routes/pricing');
const errorHandler = require('./middleware/errorHandler');
const hmacAuth = require('./middleware/hmacAuth');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.use('/ride', rideRoutes);
app.use('/pricing', pricingRoutes);

// Radar observability
app.use('/api/radar', require('./routes/radar'));

// Telemetry – events, commands, and error tracking
app.use('/api/telemetry', require('./routes/telemetry'));

// Public command endpoint – accepts unauthenticated external commands
app.use('/api/command', require('./routes/command'));

// Protected event endpoint – requires valid HMAC signature
app.use('/api/events', hmacAuth, require('./routes/events'));

app.use(errorHandler);

module.exports = app;
