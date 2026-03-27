require('dotenv').config();
const express = require('express');

const { initDbOrFail } = require('./src/db');
const rideRoutes = require('./src/routes/ride');
const pricingRoutes = require('./src/routes/pricing');
const mikeRoutes = require('./src/routes/mike');
const requestLogger = require('./src/middleware/requestLogger');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/ride', rideRoutes);
app.use('/pricing', pricingRoutes);
app.use('/mike', mikeRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

(async () => {
  await initDbOrFail();

  app.listen(PORT, () => {
    console.log(JSON.stringify({
      event: 'service_started',
      input: { port: PORT },
      output: { status: 'listening' },
      status: 'success',
      timestamp: new Date().toISOString()
    }));
  });
})();
