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

    // Telemetry: track how many times each event type has been published.
    this._publishCounts = {};
  }

  /**
   * Publish (emit) an event to all registered subscribers.
   * @param {string} eventType - One of the eventTypes constants.
   * @param {object} payload   - Arbitrary event payload.
   */
  publish(eventType, payload) {
    this._publishCounts[eventType] = (this._publishCounts[eventType] || 0) + 1;
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

  /**
   * Return a snapshot of publish counts and active subscriber counts
   * for every event type that has been used.
   *
   * @returns {{ publishCounts: object, subscriberCounts: object, totalPublished: number }}
   */
  getStats() {
    const subscriberCounts = {};
    for (const eventType of Object.keys(this._publishCounts)) {
      subscriberCounts[eventType] = this.listenerCount(eventType);
    }
    // Also include event types that have subscribers but haven't been published yet
    for (const eventType of this.eventNames()) {
      if (!(eventType in subscriberCounts)) {
        subscriberCounts[eventType] = this.listenerCount(eventType);
      }
    }

    const totalPublished = Object.values(this._publishCounts).reduce((sum, n) => sum + n, 0);

    return {
      publishCounts: { ...this._publishCounts },
      subscriberCounts,
      totalPublished,
    };
  }

  /**
   * Reset telemetry counters (useful for testing).
   */
  resetStats() {
    this._publishCounts = {};
  }
}

// Export the singleton – the entire backend shares one bus.
module.exports = new EventBus();

