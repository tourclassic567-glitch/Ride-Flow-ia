require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initWebSocket, broadcast } = require('./services/websocket');
const db = require('./db');
const orchestrator = require('./agents/AgentOrchestrator');

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
initWebSocket(server);

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

  // Start the autonomous AI agent fleet
  orchestrator.start({ broadcast });
  console.log('Autonomous agent fleet initialised');
});
