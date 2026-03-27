require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initWebSocket } = require('./services/websocket');
const db = require('./db');
const engine = require('./flows/engine');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, async () => {
  logger.info(`Ride-Flow IA backend running on port ${PORT}`);

  // Attempt DB connection gracefully
  const result = await db.query('SELECT 1').catch((err) => {
    logger.warn('Database not available – running in mock mode', { error: err.message });
    return null;
  });
  if (result) {
    logger.info('Database connected successfully');
  }

  // Initialize flow engine — load and validate all templates
  try {
    engine.loadTemplates();
    const registered = engine.list();
    logger.info('Flow engine initialized', { registeredFlows: registered.length });
    registered.forEach((f) =>
      logger.info('Registered flow', {
        name: f.name,
        version: f.version,
        steps: f.stepCount,
        triggers: f.triggers,
      })
    );
  } catch (err) {
    logger.error('Flow engine initialization failed', { error: err.message });
    process.exit(1);
  }
});
