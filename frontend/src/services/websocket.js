const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

let socket = null;
const subscribers = {};

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) return socket;

  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log('WebSocket connected');
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      const { type } = message;
      if (type && subscribers[type]) {
        subscribers[type].forEach((cb) => cb(message));
      }
      // Wildcard subscribers
      if (subscribers['*']) {
        subscribers['*'].forEach((cb) => cb(message));
      }
    } catch {
      console.warn('WS received non-JSON message');
    }
  };

  socket.onclose = () => {
    console.log('WebSocket disconnected');
    socket = null;
  };

  socket.onerror = (err) => {
    console.error('WebSocket error:', err);
  };

  return socket;
}

function subscribe(eventType, callback) {
  if (!subscribers[eventType]) {
    subscribers[eventType] = [];
  }
  subscribers[eventType].push(callback);
}

function unsubscribe(eventType, callback) {
  if (!subscribers[eventType]) return;
  subscribers[eventType] = subscribers[eventType].filter((cb) => cb !== callback);
}

function disconnect() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

export { connect, subscribe, unsubscribe, disconnect };
