require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initWebSocket } = require('./services/websocket');
const db = require('./db');

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

// Bootstrap WebSocket (also registers eventBus subscriptions internally)
initWebSocket(server);

// Register event subscribers – must happen before any flow executes
const rideSubscriber = require('./events/subscribers/rideSubscriber');
const paymentSubscriber = require('./events/subscribers/paymentSubscriber');
rideSubscriber.register();
paymentSubscriber.register();
console.log('✓ Event subscribers registered');

// Initialize radar observability
const radar = require('./observability/radar');
radar.initialize();
console.log('✓ Radar observability initialized');

server.listen(PORT, async () => {
  console.log(`Ride-Flow IA backend running on port ${PORT}`);

  // Attempt DB connection gracefully
  const result = await db.query('SELECT 1').catch((err) => {
    console.warn('Database not available – running in mock mode:', err.message);
    return null;
  });
  if (result) {
    console.log('Database connected successfully');
  }
});
