'use strict';

/**
 * WebSocket service – manages client connections and real-time broadcasts.
 *
 * All broadcasts are driven exclusively by eventBus events.
 * No external code calls broadcast() directly; instead, events are emitted
 * on the central bus and this module reacts to them.
 */

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

  // Subscribe to eventBus – the ONLY source of broadcast triggers.
  const eventBus = require('../events/eventBus');
  const eventTypes = require('../events/eventTypes');

  eventBus.subscribe(eventTypes.DRIVER_ASSIGNED, (payload) => {
    broadcast({
      type: 'RIDE_MATCHED',
      ride_id: payload.ride_id,
      driver_id: payload.driver_id,
      estimated_arrival: payload.estimated_arrival,
    });
  });

  eventBus.subscribe(eventTypes.PAYMENT_COMPLETED, (payload) => {
    broadcast({
      type: 'PAYMENT_COMPLETED',
      ride_id: payload.ride_id,
      payment_id: payload.payment_id,
      status: payload.status,
    });
  });

  eventBus.subscribe(eventTypes.FLOW_FAILED, (payload) => {
    broadcast({
      type: 'FLOW_FAILED',
      source: payload.source || payload.flowName,
      error: payload.error,
    });
  });
}

// Internal broadcast helper – used only within this module.
function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

module.exports = { clients, initWebSocket };
