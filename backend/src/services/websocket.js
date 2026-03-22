const WebSocket = require('ws');

const clients = new Set();
let wss = null;

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`WebSocket client connected. Total: ${clients.size}`);

    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw);
        console.log('WS message received, type:', message.type);
      } catch {
        console.warn('WS received non-JSON message');
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`WebSocket client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err.message);
      clients.delete(ws);
    });
  });
}

function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

module.exports = { clients, broadcast, initWebSocket };
