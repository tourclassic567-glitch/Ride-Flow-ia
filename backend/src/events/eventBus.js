'use strict';

/**
 * Central event bus – singleton EventEmitter used for all
 * intra-service communication.  Every service, flow, and
 * WebSocket layer must communicate exclusively through this bus.
 */

const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Raise the listener limit to avoid false "memory leak" warnings
    // in a system with many subscribers.
    this.setMaxListeners(100);
  }

  /**
   * Publish (emit) an event to all registered subscribers.
   * @param {string} eventType - One of the eventTypes constants.
   * @param {object} payload   - Arbitrary event payload.
   */
  publish(eventType, payload) {
    this.emit(eventType, payload);
  }

  /**
   * Subscribe (listen) to a specific event type.
   * @param {string}   eventType - One of the eventTypes constants.
   * @param {Function} handler   - Callback invoked with (payload).
   */
  subscribe(eventType, handler) {
    this.on(eventType, handler);
  }

  /**
   * Unsubscribe a previously registered handler.
   * @param {string}   eventType
   * @param {Function} handler
   */
  unsubscribe(eventType, handler) {
    this.off(eventType, handler);
  }
}

// Export the singleton – the entire backend shares one bus.
module.exports = new EventBus();
